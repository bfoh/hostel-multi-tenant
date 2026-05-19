/**
 * GET/POST /api/cron/daily-digest
 *
 * Runs every 30 minutes from Vercel cron. For each active tenant we:
 *   - Compute the tenant's local date + local time (tenants.timezone).
 *   - Check whether local time is past their configured digest send time.
 *   - If yes and the digest hasn't been sent yet for today, run the
 *     orchestrator (compute + SMS + email + push + stamp).
 *
 * Idempotency is enforced by tenant_daily_reports.digest_sent_at — re-runs
 * are harmless.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendDailyDigestForTenant } from '@/lib/digest/send'

export async function POST(req: NextRequest) {
  return handle(req)
}
export async function GET(req: NextRequest) {
  return handle(req)
}

async function handle(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
    ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    ?? req.nextUrl.searchParams.get('secret')

  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const force = req.nextUrl.searchParams.get('force') === '1'
  const onlyTenantId = req.nextUrl.searchParams.get('tenant_id')

  const admin = createAdminClient() as any

  let query = admin
    .from('tenants')
    .select('id, name, timezone, daily_digest_enabled, daily_digest_time, daily_digest_paused_until')
    .in('status', ['active', 'trial'])

  if (onlyTenantId) query = query.eq('id', onlyTenantId)

  const { data: tenants } = await query

  const results: any[] = []
  const now = new Date()

  for (const t of (tenants ?? []) as any[]) {
    if (!t.daily_digest_enabled && !force) {
      results.push({ tenant_id: t.id, skipped: true, reason: 'disabled' })
      continue
    }

    if (!force && t.daily_digest_paused_until) {
      const pauseEnd = new Date(t.daily_digest_paused_until).getTime()
      if (Number.isFinite(pauseEnd) && Date.now() < pauseEnd) {
        results.push({ tenant_id: t.id, skipped: true, reason: 'paused' })
        continue
      }
    }

    const tz = t.timezone ?? 'Africa/Accra'
    const localDate = formatLocalDate(now, tz)
    const localTime = formatLocalTime(now, tz)

    if (!force && localTime < (t.daily_digest_time ?? '19:00')) {
      results.push({ tenant_id: t.id, skipped: true, reason: 'before configured time' })
      continue
    }

    try {
      const r = await sendDailyDigestForTenant(t.id, localDate, { force })
      results.push(r)
    } catch (err: any) {
      results.push({ tenant_id: t.id, error: err?.message ?? String(err) })
    }
  }

  const sent = results.filter(r => !r.skipped && !r.error).length
  return NextResponse.json({ ok: true, sent, total: results.length, results })
}

function formatLocalDate(d: Date, tz: string): string {
  // en-CA → YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year:  'numeric',
    month: '2-digit',
    day:   '2-digit',
  }).format(d)
}

function formatLocalTime(d: Date, tz: string): string {
  // HH:MM in 24-hour
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}
