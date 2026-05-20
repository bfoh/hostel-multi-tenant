import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, baseTemplate } from '@/lib/email'
import { notifyEnquirySms } from '@/lib/enquiries/notify'

// Note: this route is open to cross-origin POSTs from each tenant's public
// marketing site. We allow the origin only when it matches the tenant's
// configured `website_url` host (or *.gh-hostels.com for previews).
//
// Inserts use the service-role admin client because public visitors are not
// authenticated against Supabase Auth; existing tenant_members RLS still
// gates dashboard reads.

export const runtime = 'nodejs'

const schema = z.object({
  full_name:           z.string().trim().min(2).max(120),
  phone:               z.string().trim().min(7).max(32),
  email:               z.string().trim().email().max(160).optional().or(z.literal('').transform(() => undefined)),
  preferred_move_in:   z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('').transform(() => undefined)),
  category_id:         z.string().trim().uuid().optional().or(z.literal('').transform(() => undefined)),
  room_of_interest:    z.string().trim().max(120).optional(),
  message:             z.string().trim().max(2000).optional().or(z.literal('').transform(() => undefined)),
  // honeypot — bots fill hidden fields. Must be empty when present.
  website:             z.string().max(0).optional(),
})

function originAllowed(origin: string | null, websiteUrl: string | null): boolean {
  if (!origin) return false
  let originHost: string
  try { originHost = new URL(origin).host.toLowerCase() } catch { return false }

  const appDomain = (process.env.APP_DOMAIN ?? process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com').toLowerCase()
  if (originHost === appDomain || originHost.endsWith(`.${appDomain}`)) return true
  if (!websiteUrl) return false
  try {
    const allowedHost = new URL(websiteUrl).host.toLowerCase()
    if (originHost === allowedHost) return true
    if (originHost === `www.${allowedHost}`) return true
    if (`www.${originHost}` === allowedHost) return true
  } catch { /* ignore malformed website_url */ }
  return false
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin':  origin ?? '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age':       '600',
    'Vary':                         'Origin',
  }
}

export async function OPTIONS(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const origin = req.headers.get('origin')

  const supabase = createAdminClient()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('website_url, is_active')
    .eq('slug', slug)
    .single()

  if (!tenant || !tenant.is_active) {
    return new NextResponse(null, { status: 204 })
  }
  if (!originAllowed(origin, tenant.website_url)) {
    return new NextResponse(null, { status: 204 })
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const origin = req.headers.get('origin')
  const supabase = createAdminClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, slug, primary_color, contact_phone, website_url, is_active')
    .eq('slug', slug)
    .single()

  if (!tenant || !tenant.is_active) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!originAllowed(origin, tenant.website_url)) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 422, headers: corsHeaders(origin) },
    )
  }
  const input = parsed.data

  // Combine message + room_of_interest hint into the stored message body so
  // the form's free-text and the room-type dropdown both survive into the
  // dashboard view (notes stays reserved for staff annotations).
  const messageBody = [
    input.room_of_interest ? `Room of interest: ${input.room_of_interest}` : null,
    input.message ?? null,
  ].filter(Boolean).join('\n\n') || null

  const { data: inserted, error } = await (supabase.from('waiting_list') as any)
    .insert({
      tenant_id:          tenant.id,
      category_id:        input.category_id ?? null,
      contact_name:       input.full_name,
      contact_phone:      input.phone,
      contact_email:      input.email ?? null,
      preferred_check_in: input.preferred_move_in ?? null,
      message:            messageBody,
      source:             'website',
      status:             'waiting',
      priority:           0,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[enquiry] insert failed:', error)
    return NextResponse.json(
      { error: 'Could not save enquiry' },
      { status: 500, headers: corsHeaders(origin) },
    )
  }

  // Fire notifications in the background — never block the visitor's response.
  // Errors are swallowed inside the helpers and only logged.
  void dispatchNotifications({
    tenantId:    tenant.id,
    tenantName:  tenant.name,
    primaryColor: tenant.primary_color ?? '#111827',
    tenantPhone: tenant.contact_phone,
    enquiryId:   inserted.id,
    name:        input.full_name,
    phone:       input.phone,
    email:       input.email ?? null,
    preferredCheckIn: input.preferred_move_in ?? null,
    roomOfInterest:   input.room_of_interest ?? null,
    message:     input.message ?? null,
  })

  return NextResponse.json(
    { ok: true, id: inserted.id },
    { status: 201, headers: corsHeaders(origin) },
  )
}

interface NotifyArgs {
  tenantId:         string
  tenantName:       string
  primaryColor:     string
  tenantPhone:      string | null
  enquiryId:        string
  name:             string
  phone:            string
  email:            string | null
  preferredCheckIn: string | null
  roomOfInterest:   string | null
  message:          string | null
}

async function dispatchNotifications(args: NotifyArgs): Promise<void> {
  const admin = createAdminClient()

  // ── Resolve admin/manager/owner emails for this tenant ─────────────────
  const { data: members } = await admin
    .from('tenant_members')
    .select('user_id, role')
    .eq('tenant_id', args.tenantId)
    .eq('is_active', true)
    .in('role', ['owner', 'manager'])

  const adminEmails: string[] = []
  if (members && members.length > 0) {
    try {
      const { data: { users } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const wantedIds = new Set(members.map((m: any) => m.user_id))
      for (const u of users) {
        if (u.email && wantedIds.has(u.id)) adminEmails.push(u.email)
      }
    } catch (err) {
      console.error('[enquiry] listUsers failed:', err)
    }
  }

  // ── Email ──────────────────────────────────────────────────────────────
  if (adminEmails.length > 0) {
    const subject = `New website enquiry — ${args.name}`
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      ?? `https://${process.env.APP_DOMAIN ?? process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'}`
    const dashboardUrl = `${appUrl}/waiting-list?source=website`
    const html = baseTemplate(args.tenantName, args.primaryColor, enquiryEmailContent({
      ...args,
      dashboardUrl,
    }))
    const result = await sendEmail({
      to:        adminEmails,
      subject,
      html,
      replyTo:   args.email ?? undefined,
    })
    if (!result.ok) console.error('[enquiry] email failed:', result.error)
  }

  // ── SMS to tenant's primary contact phone ─────────────────────────────
  if (args.tenantPhone) {
    await notifyEnquirySms({
      tenantId:   args.tenantId,
      tenantName: args.tenantName,
      toPhone:    args.tenantPhone,
      enquirerName:  args.name,
      enquirerPhone: args.phone,
      roomOfInterest: args.roomOfInterest,
    })
  }
}

function enquiryEmailContent(args: NotifyArgs & { dashboardUrl: string }): string {
  const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]!))

  function row(label: string, value: string) {
    return `<tr>
      <td style="padding:6px 0;font-size:14px;color:#6b7280;width:160px;">${label}</td>
      <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:500;">${value}</td>
    </tr>`
  }

  const detailRows = [
    row('Name', escape(args.name)),
    row('Phone', `<a href="tel:${escape(args.phone)}" style="color:${args.primaryColor};">${escape(args.phone)}</a>`),
    args.email      ? row('Email', `<a href="mailto:${escape(args.email)}" style="color:${args.primaryColor};">${escape(args.email)}</a>`) : '',
    args.preferredCheckIn ? row('Preferred move-in', escape(args.preferredCheckIn)) : '',
    args.roomOfInterest   ? row('Room of interest', escape(args.roomOfInterest)) : '',
  ].join('')

  const messageBlock = args.message
    ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin:16px 0;">
         <p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Enquiry</p>
         <p style="margin:0;font-size:14px;color:#111827;white-space:pre-wrap;">${escape(args.message)}</p>
       </div>`
    : ''

  return `
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">New website enquiry</p>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">
      A prospect just submitted the enquiry form on your website.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:8px;">
      ${detailRows}
    </table>
    ${messageBlock}
    <a href="${args.dashboardUrl}"
      style="display:inline-block;margin-top:16px;padding:12px 22px;background:${args.primaryColor};color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
      Open waiting list
    </a>
    <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">
      Reply to this email to respond directly to ${escape(args.name)}.
    </p>
  `
}
