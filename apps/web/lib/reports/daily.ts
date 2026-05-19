/**
 * Daily operations report helpers.
 *
 * Reads from `tenant_daily_reports`. If the requested date is today and the
 * row is missing or stale (>5 minutes), recomputes via the
 * `compute_daily_report(tenant_id, date)` SQL function so the dashboard
 * always reflects current activity.
 */
import { createAdminClient } from '@/lib/supabase/admin'

const STALE_MS = 5 * 60 * 1000

export interface DailyReport {
  tenant_id:                    string
  report_date:                  string                   // YYYY-MM-DD
  computed_at:                  string
  digest_sent_at:               string | null

  // Revenue (pesewas)
  revenue_total:                number
  revenue_rooms:                number
  revenue_food:                 number
  revenue_pos:                  number
  revenue_walkin:               number
  revenue_deposits:             number

  rev_cash:                     number
  rev_momo:                     number
  rev_card:                     number
  rev_bank:                     number
  rev_online_other:             number

  outstanding_balance:          number
  overdue_installments_count:   number
  overdue_installments_amount:  number

  rooms_total:                  number
  rooms_occupied:               number
  rooms_reserved:               number
  rooms_dirty:                  number
  rooms_maintenance:            number
  occupancy_pct:                number

  arrivals_today:               number
  departures_today:             number
  no_shows_today:               number
  walkin_count:                 number
  food_orders_count:            number

  cash_expected:                number
  cash_counted:                 number
  cash_variance:                number
  bank_drafts_pending:          number

  maintenance_open:             number
  maintenance_resolved_today:   number
  housekeeping_pending:         number
  laundry_in_progress:          number

  anomalies_critical:           number
  anomalies_warning:            number
  first_anomaly_msg:            string | null

  arrivals_next_7d:             number
  renewals_due_30d:             number
  lease_expiry_30d:             number
}

/**
 * Return the tenant's local "today" as a YYYY-MM-DD string. Reads
 * `tenants.timezone` (defaults to Africa/Accra).
 */
export async function getTenantToday(tenantId: string): Promise<string> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('tenants')
    .select('timezone')
    .eq('id', tenantId)
    .single()
  const tz = (data as any)?.timezone ?? 'Africa/Accra'
  // Use Intl to format current instant in tenant tz as YYYY-MM-DD
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year:  'numeric',
    month: '2-digit',
    day:   '2-digit',
  })
  return fmt.format(new Date())
}

/**
 * Force a recompute via the PL/pgSQL function. Returns the fresh row.
 */
export async function recomputeDailyReport(
  tenantId: string,
  date:     string,
): Promise<DailyReport | null> {
  const admin = createAdminClient()
  const { data, error } = await (admin as any).rpc('compute_daily_report', {
    p_tenant_id: tenantId,
    p_date:      date,
  })
  if (error) {
    console.error('[compute_daily_report]', error)
    return null
  }
  // RPC returning a table row gives back an object directly
  return (Array.isArray(data) ? data[0] : data) ?? null
}

/**
 * Fetch a report row, recomputing on demand when:
 *   - the date is today (live freshness), and
 *   - the cached row is missing or stale (>5 min old).
 */
export async function getDailyReport(
  tenantId: string,
  date:     string,
  opts:     { forceRecompute?: boolean } = {},
): Promise<DailyReport | null> {
  if (opts.forceRecompute) {
    return recomputeDailyReport(tenantId, date)
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('tenant_daily_reports')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('report_date', date)
    .maybeSingle()

  const todayLocal = await getTenantToday(tenantId)
  const isToday = date === todayLocal

  if (!data) {
    return recomputeDailyReport(tenantId, date)
  }

  if (isToday) {
    const age = Date.now() - new Date((data as any).computed_at).getTime()
    if (age > STALE_MS) return recomputeDailyReport(tenantId, date)
  }

  return data as unknown as DailyReport
}

/**
 * Fetch a contiguous range of reports (oldest → newest). Missing days
 * are NOT auto-computed; this is for trends + week/month rollups, where
 * absence of a row implies zero activity (acceptable for owner views).
 */
export async function listDailyReports(
  tenantId: string,
  startDate: string,
  endDate:   string,
): Promise<DailyReport[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('tenant_daily_reports')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('report_date', startDate)
    .lte('report_date', endDate)
    .order('report_date', { ascending: true })
  return (data ?? []) as unknown as DailyReport[]
}

/* ── Aggregation helpers (used by owner dashboard tabs) ──────────────────── */

export interface DailyRollup {
  revenue_total:      number
  revenue_rooms:      number
  revenue_food:       number
  revenue_pos:        number
  revenue_walkin:     number
  rev_cash:           number
  rev_momo:           number
  rev_card:           number
  rev_bank:           number
  occupancy_pct_avg:  number
  arrivals:           number
  departures:         number
  walkin_count:       number
  food_orders_count:  number
  cash_variance:      number
  days:               number
}

export function rollupReports(rows: DailyReport[]): DailyRollup {
  if (rows.length === 0) {
    return {
      revenue_total: 0, revenue_rooms: 0, revenue_food: 0, revenue_pos: 0, revenue_walkin: 0,
      rev_cash: 0, rev_momo: 0, rev_card: 0, rev_bank: 0,
      occupancy_pct_avg: 0,
      arrivals: 0, departures: 0, walkin_count: 0, food_orders_count: 0,
      cash_variance: 0,
      days: 0,
    }
  }
  const sum = (k: keyof DailyReport) =>
    rows.reduce((s, r) => s + (Number(r[k]) || 0), 0)

  return {
    revenue_total:    sum('revenue_total'),
    revenue_rooms:    sum('revenue_rooms'),
    revenue_food:     sum('revenue_food'),
    revenue_pos:      sum('revenue_pos'),
    revenue_walkin:   sum('revenue_walkin'),
    rev_cash:         sum('rev_cash'),
    rev_momo:         sum('rev_momo'),
    rev_card:         sum('rev_card'),
    rev_bank:         sum('rev_bank'),
    occupancy_pct_avg:
      rows.reduce((s, r) => s + Number(r.occupancy_pct || 0), 0) / rows.length,
    arrivals:          sum('arrivals_today'),
    departures:        sum('departures_today'),
    walkin_count:      sum('walkin_count'),
    food_orders_count: sum('food_orders_count'),
    cash_variance:     sum('cash_variance'),
    days:              rows.length,
  }
}

export interface PctDelta {
  current:  number
  previous: number
  delta:    number   // signed difference
  pct:      number   // signed % change (0 when previous is 0)
}

export function deltaVs(current: number, previous: number): PctDelta {
  const delta = current - previous
  const pct = previous > 0 ? (delta / previous) * 100 : 0
  return { current, previous, delta, pct }
}
