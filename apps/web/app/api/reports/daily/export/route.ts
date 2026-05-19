/**
 * GET /api/reports/daily/export?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns a CSV of pre-aggregated tenant_daily_reports rows in the given
 * inclusive range. Amounts are emitted in pesewas to keep round-tripping
 * exact; the spreadsheet can apply a /100 formula if needed.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { listDailyReports, type DailyReport } from '@/lib/reports/daily'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const COLUMNS: (keyof DailyReport)[] = [
  'report_date',
  'revenue_total',
  'revenue_rooms',
  'revenue_food',
  'revenue_pos',
  'revenue_walkin',
  'revenue_deposits',
  'rev_cash',
  'rev_momo',
  'rev_card',
  'rev_bank',
  'rev_online_other',
  'outstanding_balance',
  'overdue_installments_count',
  'overdue_installments_amount',
  'rooms_total',
  'rooms_occupied',
  'rooms_reserved',
  'rooms_dirty',
  'rooms_maintenance',
  'occupancy_pct',
  'arrivals_today',
  'departures_today',
  'no_shows_today',
  'walkin_count',
  'food_orders_count',
  'cash_expected',
  'cash_counted',
  'cash_variance',
  'bank_drafts_pending',
  'maintenance_open',
  'maintenance_resolved_today',
  'housekeeping_pending',
  'laundry_in_progress',
  'anomalies_critical',
  'anomalies_warning',
  'arrivals_next_7d',
  'renewals_due_30d',
  'lease_expiry_30d',
]

export async function GET(req: NextRequest) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const from = req.nextUrl.searchParams.get('from')
  const to   = req.nextUrl.searchParams.get('to')
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json({ error: 'from + to required (YYYY-MM-DD)' }, { status: 422 })
  }

  const rows = await listDailyReports(tenantId, from, to)

  const header = COLUMNS.join(',')
  const body = rows
    .map((r) => COLUMNS.map((c) => csvCell(r[c])).join(','))
    .join('\n')

  const csv = `${header}\n${body}\n`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type':        'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="daily-report_${from}_${to}.csv"`,
      'cache-control':       'private, no-store',
    },
  })
}

function csvCell(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'number') return String(v)
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
