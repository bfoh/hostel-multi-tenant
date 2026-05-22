import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, baseTemplate, button } from '@/lib/email'
import { sendPushToTenant } from '@/lib/push'
import { formatPhone } from '@/lib/sms'

/**
 * POST /api/communications/broadcast
 * Send a message to a filtered set of occupants via SMS, email, and/or push.
 */
export async function POST(req: NextRequest) {
  // Authenticate the caller via the user-bound client, then switch to the
  // admin client for tenant data reads. RLS on the user-bound client depends
  // on tenant_id being present in the JWT claims, which is brittle right
  // after onboarding — the rest of the tenant data layer also uses the admin
  // client and scopes queries explicitly with .eq('tenant_id', tenantId).
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const supabase = createAdminClient()

  const body = await req.json()
  const { target, channels, subject, message } = body as {
    target: 'all' | 'checked_in' | 'confirmed' | 'overdue_balance'
    channels: ('sms' | 'email' | 'push')[]
    subject: string
    message: string
  }

  if (!message?.trim()) return NextResponse.json({ error: 'message is required' }, { status: 400 })
  if (!channels?.length) return NextResponse.json({ error: 'at least one channel required' }, { status: 400 })

  // Resolve occupants based on target.
  //
  // The booking-based filters (checked_in / confirmed / overdue_balance) need
  // booking state, so they go through the bookings table. The "all" filter is
  // about active people on file — query occupants directly so tenants whose
  // residents don't have an open booking row (e.g. fresh imports, or anyone
  // whose only booking is in 'enquiry' state) still receive broadcasts.
  const seen    = new Set<string>()
  const targets: { name: string; phone: string | null; email: string | null }[] = []

  if (target === 'all') {
    const { data: occs } = await supabase
      .from('occupants')
      .select('id, first_name, last_name, phone, email, status')
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'pending'])
      .limit(500)

    for (const occ of occs ?? []) {
      if (seen.has(occ.id)) continue
      seen.add(occ.id)
      targets.push({
        name:  `${occ.first_name} ${occ.last_name}`,
        phone: occ.phone ?? null,
        email: occ.email ?? null,
      })
    }
  } else {
    let bookingQuery = supabase
      .from('bookings')
      .select('occupant_id, payment_status, paid_amount, final_amount, occupants(first_name, last_name, phone, email)')
      .eq('tenant_id', tenantId)

    if (target === 'checked_in') {
      bookingQuery = bookingQuery.eq('status', 'checked_in')
    } else if (target === 'confirmed') {
      bookingQuery = bookingQuery.in('status', ['confirmed', 'checked_in'])
    } else if (target === 'overdue_balance') {
      bookingQuery = bookingQuery
        .in('status', ['confirmed', 'checked_in'])
        .eq('payment_status', 'unpaid')
    }

    const { data: bookings } = await bookingQuery.limit(500)

    for (const b of bookings ?? []) {
      if (!b.occupant_id || seen.has(b.occupant_id)) continue
      seen.add(b.occupant_id)
      const occ = Array.isArray(b.occupants) ? b.occupants[0] : b.occupants
      if (occ) {
        targets.push({
          name:  `${occ.first_name} ${occ.last_name}`,
          phone: occ.phone ?? null,
          email: occ.email ?? null,
        })
      }
    }
  }

  if (targets.length === 0) {
    return NextResponse.json({ error: 'No occupants match the target filter', sent: 0 }, { status: 400 })
  }

  // Fetch tenant info
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, primary_color, slug, logo_url')
    .eq('id', tenantId)
    .single()

  const results = { sms: 0, email: 0, push: 0, errors: [] as string[] }

  // ── SMS via Arkesel ────────────────────────────────────────────────────────
  if (channels.includes('sms') && process.env.ARKESEL_API_KEY) {
    // Normalise phones to Arkesel's expected format (233XXXXXXXXX). Local
    // 0244-prefixed numbers were silently rejected before because the API
    // returns 200 OK with per-recipient errors that we never inspected.
    const phones = targets
      .map((t) => t.phone)
      .filter((p): p is string => !!p && p.trim().length > 0)
      .map(formatPhone)
      .filter((p) => p.length >= 11)

    if (phones.length === 0) {
      results.errors.push('SMS: no recipients with a valid phone number')
    } else {
      // Sender ID must be pre-registered with Arkesel. Tenant names are not,
      // so default to ARKESEL_SENDER_ID like every other SMS path in the app.
      const sender = process.env.ARKESEL_SENDER_ID || 'GH Hostels'
      try {
        const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
          method: 'POST',
          headers: {
            'api-key': process.env.ARKESEL_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sender, message, recipients: phones }),
        })
        const body = await res.json().catch(() => null) as
          | { status?: string; message?: string; data?: Array<{ recipient: string; status: string }> }
          | null

        if (!res.ok || body?.status !== 'success') {
          results.errors.push(`SMS: ${body?.message ?? `HTTP ${res.status}`}`)
        } else {
          // Arkesel reports per-recipient status. Count only the ones it
          // actually queued for delivery.
          const delivered = body.data?.filter((d) => d.status === 'success').length ?? phones.length
          const failed    = (body.data?.length ?? 0) - delivered
          results.sms = delivered
          if (failed > 0) {
            const reasons = Array.from(new Set(body.data!
              .filter((d) => d.status !== 'success')
              .map((d) => d.status)))
              .join(', ')
            results.errors.push(`SMS: ${failed} recipient(s) failed (${reasons})`)
          }
        }
      } catch (e) {
        results.errors.push(`SMS: ${e instanceof Error ? e.message : 'failed'}`)
      }
    }
  }

  // ── Email via Resend ───────────────────────────────────────────────────────
  if (channels.includes('email') && process.env.RESEND_API_KEY) {
    const emailTargets = targets.filter((t) => t.email)
    for (const t of emailTargets) {
      const html = baseTemplate(
        tenant?.name ?? 'Hostel',
        tenant?.primary_color ?? '',
        `<p style="font-size:15px;color:#374151;line-height:1.6;">${message.replace(/\n/g, '<br>')}</p>`,
        tenant?.logo_url ?? null
      )
      const sent = await sendEmail({
        to:         t.email!,
        senderName: tenant?.name ?? undefined,
        subject:    subject || `Message from ${tenant?.name ?? 'your hostel'}`,
        html,
      })
      results.email++
    }
  }

  // ── Push ───────────────────────────────────────────────────────────────────
  if (channels.includes('push')) {
    try {
      await sendPushToTenant(tenantId, {
        title: subject || tenant?.name || 'Hostel',
        body:  message,
        url:   '/',
      })
      results.push = targets.length
    } catch (e) {
      results.errors.push(`Push: ${e instanceof Error ? e.message : 'failed'}`)
    }
  }

  // Log the broadcast
  await (supabase.from('sms_blasts') as any).insert({
    tenant_id:       tenantId,
    message,
    recipient_filter: target,
    sent_count:      Math.max(results.sms, results.email, results.push),
    status:          'sent',
    sent_by:         user.id,
  }).select().maybeSingle()

  return NextResponse.json({ ok: true, recipients: targets.length, results })
}
