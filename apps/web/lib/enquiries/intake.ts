/**
 * Shared enquiry intake — used by both the browser-CORS public route
 * (`/api/public/[slug]/enquiry`) and the secret-authed webhook route
 * (`/api/webhooks/enquiry/[slug]`). Inserts a waiting_list row with
 * source='website', then fires email + SMS notifications to the tenant
 * in the background.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, baseTemplate } from '@/lib/email'
import { notifyEnquirySms } from '@/lib/enquiries/notify'

export interface EnquiryInput {
  full_name:          string
  phone:              string
  email?:             string | null
  preferred_move_in?: string | null  // YYYY-MM-DD
  category_id?:       string | null
  room_of_interest?:  string | null
  message?:           string | null
}

export interface IntakeTenant {
  id:            string
  name:          string
  primary_color: string | null
  contact_phone: string | null
}

export async function insertEnquiry(
  tenant: IntakeTenant,
  input: EnquiryInput,
): Promise<{ id: string } | { error: string }> {
  const supabase = createAdminClient()

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
    return { error: error.message }
  }
  return { id: inserted.id }
}

export function fireNotifications(
  tenant: IntakeTenant,
  enquiryId: string,
  input: EnquiryInput,
): void {
  // Fire-and-forget — visitor's response must not wait on email/SMS.
  void dispatchNotifications(tenant, enquiryId, input)
}

async function dispatchNotifications(
  tenant: IntakeTenant,
  enquiryId: string,
  input: EnquiryInput,
): Promise<void> {
  const admin = createAdminClient()

  const { data: members } = await admin
    .from('tenant_members')
    .select('user_id, role')
    .eq('tenant_id', tenant.id)
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

  if (adminEmails.length > 0) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      ?? `https://${process.env.APP_DOMAIN ?? process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'}`
    const dashboardUrl = `${appUrl}/waiting-list?source=website`
    const primaryColor = tenant.primary_color ?? '#111827'
    const html = baseTemplate(tenant.name, primaryColor, enquiryEmailContent({
      tenantName: tenant.name,
      primaryColor,
      dashboardUrl,
      input,
    }))
    const result = await sendEmail({
      to:        adminEmails,
      subject:   `New website enquiry — ${input.full_name}`,
      html,
      replyTo:   input.email ?? undefined,
    })
    if (!result.ok) console.error('[enquiry] email failed:', result.error)
  }

  if (tenant.contact_phone) {
    await notifyEnquirySms({
      tenantId:       tenant.id,
      tenantName:     tenant.name,
      toPhone:        tenant.contact_phone,
      enquirerName:   input.full_name,
      enquirerPhone:  input.phone,
      roomOfInterest: input.room_of_interest ?? null,
    })
  }
}

function enquiryEmailContent(args: {
  tenantName:   string
  primaryColor: string
  dashboardUrl: string
  input:        EnquiryInput
}): string {
  const { tenantName: _tn, primaryColor, dashboardUrl, input } = args
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
    row('Name', escape(input.full_name)),
    row('Phone', `<a href="tel:${escape(input.phone)}" style="color:${primaryColor};">${escape(input.phone)}</a>`),
    input.email             ? row('Email', `<a href="mailto:${escape(input.email)}" style="color:${primaryColor};">${escape(input.email)}</a>`) : '',
    input.preferred_move_in ? row('Preferred move-in', escape(input.preferred_move_in)) : '',
    input.room_of_interest  ? row('Room of interest', escape(input.room_of_interest)) : '',
  ].join('')

  const messageBlock = input.message
    ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin:16px 0;">
         <p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Enquiry</p>
         <p style="margin:0;font-size:14px;color:#111827;white-space:pre-wrap;">${escape(input.message)}</p>
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
    <a href="${dashboardUrl}"
      style="display:inline-block;margin-top:16px;padding:12px 22px;background:${primaryColor};color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
      Open waiting list
    </a>
    <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">
      Reply to this email to respond directly to ${escape(input.full_name)}.
    </p>
  `
}
