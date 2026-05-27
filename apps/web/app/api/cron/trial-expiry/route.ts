/**
 * GET/POST /api/cron/trial-expiry
 *
 * Hourly sweep that drives the free-trial lifecycle:
 *   - T-3 days from trial_ends_at  → send 3-day warning email (once)
 *   - T-1 day  from trial_ends_at  → send 1-day warning email (once)
 *   - T+0      past trial_ends_at  → flip status to 'suspended' and send the
 *                                    "trial ended" email
 *
 * Idempotency is enforced by per-tenant timestamp columns:
 *   trial_warning_3d_sent_at, trial_warning_1d_sent_at, trial_expired_at.
 * Once a column is set the cron skips that tenant for that stage. Re-running
 * the cron after a partial outage is therefore harmless.
 *
 * Auth: matches the existing daily-digest pattern — accepts CRON_SECRET via
 * x-cron-secret header, Authorization Bearer header, or ?secret= query.
 * Vercel cron requests carry the Bearer header automatically.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, trialWarningHtml, trialExpiredHtml } from '@/lib/email'

export async function POST(req: NextRequest) { return handle(req) }
export async function GET(req: NextRequest)  { return handle(req) }

type TrialTenant = {
  id:                       string
  name:                     string
  slug:                     string
  primary_color:            string | null
  logo_url:                 string | null
  contact_email:            string | null
  trial_ends_at:            string
  trial_warning_3d_sent_at: string | null
  trial_warning_1d_sent_at: string | null
}

async function handle(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
    ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    ?? req.nextUrl.searchParams.get('secret')

  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient() as any
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'
  const protocol  = appDomain.includes('localhost') ? 'http' : 'https'
  const billingUrlFor = (slug: string) =>
    `${protocol}://${slug}.${appDomain}/settings/billing`

  const now           = new Date()
  const in3Days       = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const in1Day        = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000)

  // Pull every trial tenant that still has an end date set. The cron is small
  // enough today to skip pagination — even at 10k trial tenants, this is one
  // index scan via the partial idx on trial_ends_at.
  const { data: rows, error } = await admin
    .from('tenants')
    .select(`
      id, name, slug, primary_color, logo_url, contact_email,
      trial_ends_at, trial_warning_3d_sent_at, trial_warning_1d_sent_at
    `)
    .eq('status', 'trial')
    .not('trial_ends_at', 'is', null)

  if (error) {
    console.error('[cron/trial-expiry] tenant query failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const tenants = (rows ?? []) as TrialTenant[]

  let warned3d = 0
  let warned1d = 0
  let expired  = 0

  // Resolve the owner email per tenant from tenant_members(role='owner') →
  // auth.users.email. tenants.contact_email (configured during onboarding)
  // is a fallback because not every owner sets a contact email.
  for (const t of tenants) {
    const ends = new Date(t.trial_ends_at)
    const ownerEmail = await resolveOwnerEmail(admin, t.id, t.contact_email)
    if (!ownerEmail) continue

    const primaryColor = t.primary_color ?? '#1B4F72'
    const billingUrl   = billingUrlFor(t.slug)
    const endsLabel    = ends.toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Accra',
    })

    // ── T+0: trial expired → suspend tenant + send "expired" email ────────
    if (ends <= now) {
      // Mark timestamp first so a Resend retry can't double-fire the email.
      const { error: updErr } = await admin
        .from('tenants')
        .update({ status: 'suspended', trial_expired_at: now.toISOString() })
        .eq('id', t.id)
        .eq('status', 'trial')

      if (updErr) {
        console.error(`[cron/trial-expiry] suspend ${t.id} failed:`, updErr.message)
        continue
      }

      await sendEmail({
        to:         ownerEmail,
        subject:    `Your ${t.name} trial has ended`,
        senderName: t.name,
        html: trialExpiredHtml({
          hostelName:   t.name,
          primaryColor,
          logoUrl:      t.logo_url,
          billingUrl,
        }),
      })
      expired++
      continue
    }

    // ── T-1 day window ────────────────────────────────────────────────────
    if (!t.trial_warning_1d_sent_at && ends <= in1Day) {
      await admin
        .from('tenants')
        .update({ trial_warning_1d_sent_at: now.toISOString() })
        .eq('id', t.id)

      await sendEmail({
        to:         ownerEmail,
        subject:    `Last day: your ${t.name} trial ends tomorrow`,
        senderName: t.name,
        html: trialWarningHtml({
          hostelName:   t.name,
          primaryColor,
          logoUrl:      t.logo_url,
          daysLeft:     1,
          trialEndsAt:  endsLabel,
          billingUrl,
        }),
      })
      warned1d++
      continue
    }

    // ── T-3 day window ────────────────────────────────────────────────────
    if (!t.trial_warning_3d_sent_at && ends <= in3Days) {
      await admin
        .from('tenants')
        .update({ trial_warning_3d_sent_at: now.toISOString() })
        .eq('id', t.id)

      await sendEmail({
        to:         ownerEmail,
        subject:    `Your ${t.name} trial ends in 3 days`,
        senderName: t.name,
        html: trialWarningHtml({
          hostelName:   t.name,
          primaryColor,
          logoUrl:      t.logo_url,
          daysLeft:     3,
          trialEndsAt:  endsLabel,
          billingUrl,
        }),
      })
      warned3d++
    }
  }

  return NextResponse.json({
    ok:      true,
    scanned: tenants.length,
    warned3d,
    warned1d,
    expired,
  })
}

async function resolveOwnerEmail(
  admin: any,
  tenantId: string,
  contactEmailFallback: string | null,
): Promise<string | null> {
  const { data: member } = await admin
    .from('tenant_members')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('role', 'owner')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (member?.user_id) {
    try {
      const { data } = await admin.auth.admin.getUserById(member.user_id)
      const email = data?.user?.email ?? null
      if (email) return email
    } catch (err) {
      console.error('[cron/trial-expiry] owner lookup failed:', err)
    }
  }

  return contactEmailFallback
}
