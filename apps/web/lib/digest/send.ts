/**
 * Daily digest orchestrator.
 *
 *   sendDailyDigestForTenant(tenantId, today)
 *     → compute_daily_report (always)
 *     → for each enabled channel: dispatch SMS / email / push
 *     → stamp tenant_daily_reports.digest_sent_at
 *
 * Channel toggles + recipients live on the `tenants` row
 * (daily_digest_enabled, daily_digest_channels, daily_digest_recipients).
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { recomputeDailyReport, getDailyReport, type DailyReport } from '@/lib/reports/daily'
import { buildDigestSms } from './sms'
import { buildDigestEmail } from './email'
import { buildDigestPush } from './push'

interface Recipient {
  name?:  string
  phone?: string | null
  email?: string | null
}

interface ChannelToggles {
  sms?:   boolean
  email?: boolean
  push?:  boolean
}

export interface DigestSendResult {
  tenantId:    string
  date:        string
  sms_sent:    number
  email_sent:  number
  push_sent:   number
  skipped:     boolean
  reason?:     string
  errors?:     string[]
  recipients_total?: number
}

const DEFAULT_CHANNELS: ChannelToggles = { sms: true, email: true, push: true }

function isoMinus(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

export async function sendDailyDigestForTenant(
  tenantId: string,
  date:     string,
  opts:     { force?: boolean; appUrl?: string } = {},
): Promise<DigestSendResult> {
  const admin = createAdminClient() as any

  // Tenant + recipient + channel config
  const { data: tenant } = await admin
    .from('tenants')
    .select(`
      id, name, slug, primary_color, contact_phone, contact_email, logo_url,
      daily_digest_enabled, daily_digest_channels, daily_digest_recipients
    `)
    .eq('id', tenantId)
    .single()

  if (!tenant) return zeroResult(tenantId, date, 'tenant not found')
  if (!tenant.daily_digest_enabled && !opts.force) {
    return zeroResult(tenantId, date, 'digest disabled')
  }

  // Snapshot — always recompute so the digest reflects end-of-day
  const report = await recomputeDailyReport(tenantId, date)
  if (!report) {
    return zeroResult(
      tenantId,
      date,
      'compute_daily_report returned no rows — check server logs for the RPC error',
    )
  }

  // Skip if already sent today (unless forced)
  if (report.digest_sent_at && !opts.force) {
    return zeroResult(tenantId, date, 'already sent')
  }

  const yesterday        = await getDailyReport(tenantId, isoMinus(date, 1))
  const sameDayLastWeek  = await getDailyReport(tenantId, isoMinus(date, 7))

  const channels: ChannelToggles = {
    ...DEFAULT_CHANNELS,
    ...(tenant.daily_digest_channels ?? {}),
  }

  // Collect recipients — primary owner first, then extras
  const recipients: Recipient[] = [
    { phone: tenant.contact_phone, email: tenant.contact_email },
    ...((tenant.daily_digest_recipients ?? []) as Recipient[]),
  ]

  const appUrl = opts.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
  const dashboardUrl = `${appUrl}/dashboard/owner?ref=digest`
  const brand = tenant.primary_color ?? '#2563EB'

  let smsCount = 0
  let emailCount = 0
  let pushCount = 0
  const errors: string[] = []

  // ── SMS ────────────────────────────────────────────────────────────────
  if (channels.sms) {
    if (!process.env.ARKESEL_API_KEY) {
      errors.push('SMS skipped: ARKESEL_API_KEY env var is not set')
    } else {
      const body = buildDigestSms({
        hostelName:   tenant.name,
        report,
        yesterday,
        dashboardUrl,
      })
      const withPhone = recipients.filter((r) => r.phone)
      if (withPhone.length === 0) {
        errors.push('SMS skipped: no recipient has a phone number')
      }
      for (const r of withPhone) {
        try {
          await sendSmsRaw(r.phone!, body)
          smsCount++
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          errors.push(`SMS to ${r.phone}: ${msg}`)
          console.error(`[digest sms] ${tenantId} ${r.phone}`, err)
        }
      }
    }
  }

  // ── Email ──────────────────────────────────────────────────────────────
  if (channels.email) {
    if (!process.env.RESEND_API_KEY) {
      errors.push('Email skipped: RESEND_API_KEY env var is not set')
    } else {
      const { subject, html } = buildDigestEmail({
        hostelName:    tenant.name,
        primaryColor:  brand,
        logoUrl:       tenant.logo_url,
        report,
        yesterday,
        sameDayLastWeek,
        dashboardUrl,
      })
      const { sendEmail } = await import('@/lib/email')
      const withEmail = recipients.filter((r) => r.email)
      if (withEmail.length === 0) {
        errors.push('Email skipped: no recipient has an email')
      }
      for (const r of withEmail) {
        try {
          await sendEmail({
            to:         r.email!,
            senderName: tenant.name,
            subject,
            html,
          })
          emailCount++
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          errors.push(`Email to ${r.email}: ${msg}`)
          console.error(`[digest email] ${tenantId} ${r.email}`, err)
        }
      }
    }
  }

  // ── Push ───────────────────────────────────────────────────────────────
  if (channels.push) {
    try {
      const { sendPushToUsers } = await import('@/lib/push')
      const { data: members } = await admin
        .from('tenant_members')
        .select('user_id, role')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .in('role', ['owner', 'manager'])
      const userIds = ((members ?? []) as any[]).map((m: any) => m.user_id as string)
      if (userIds.length === 0) {
        errors.push('Push skipped: no active owner/manager members on this tenant')
      } else {
        const payload = buildDigestPush({ hostelName: tenant.name, report })
        const sent = await sendPushToUsers(tenantId, userIds, payload)
        pushCount = sent.delivered
        if (pushCount === 0) {
          errors.push(
            `Push skipped: ${sent.reason ?? 'no recipients have an active web-push subscription'}`,
          )
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`Push: ${msg}`)
      console.error(`[digest push] ${tenantId}`, err)
    }
  }

  // ── Stamp ──────────────────────────────────────────────────────────────
  await admin
    .from('tenant_daily_reports')
    .update({ digest_sent_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('report_date', date)

  return {
    tenantId,
    date,
    sms_sent:   smsCount,
    email_sent: emailCount,
    push_sent:  pushCount,
    skipped:    false,
    recipients_total: recipients.length,
    ...(errors.length ? { errors } : {}),
  }
}

function zeroResult(tenantId: string, date: string, reason: string): DigestSendResult {
  return { tenantId, date, sms_sent: 0, email_sent: 0, push_sent: 0, skipped: true, reason }
}

/* ── Direct SMS sender ─────────────────────────────────────────────────── */
// Bypass tenant template plumbing — digest body is the message verbatim.
async function sendSmsRaw(phone: string, message: string): Promise<void> {
  if (!process.env.ARKESEL_API_KEY) {
    console.info('[digest sms] ARKESEL_API_KEY not set — skipping', phone)
    return
  }
  const digits = phone.replace(/\D/g, '')
  const recipient = digits.startsWith('0') && digits.length === 10
    ? `233${digits.slice(1)}`
    : digits

  const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
    method:  'POST',
    headers: { 'api-key': process.env.ARKESEL_API_KEY, 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      sender:     process.env.ARKESEL_SENDER_ID || 'GH Hostels',
      message,
      recipients: [recipient],
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error('[digest sms] Arkesel error', res.status, text)
  }
}
