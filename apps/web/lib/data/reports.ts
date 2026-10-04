import { createAdminClient } from '@/lib/supabase/admin'
import {
  getBookingAgingRows,
  getBookingFinancialSummary,
  getBookingRevenueBreakdown,
} from '@/lib/data/booking-finance'

/* ── helpers ──────────────────────────────────────────────────────── */

function monthStart(offset = 0) {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1)).toISOString()
}

function nextMonthStart(offset = 0) {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset + 1, 1)).toISOString()
}

/* ── Revenue report ───────────────────────────────────────────────── */

export async function getRevenueReport(tenantId: string, months = 6) {
  const results: { month: string; label: string; amount: number }[] = []

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date()
    d.setUTCMonth(d.getUTCMonth() - i)
    const label = d.toLocaleDateString('en-GH', { month: 'short', year: 'numeric' })
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`

    const start = monthStart(-i)
    const end   = nextMonthStart(-i)
    const receipts = await getBookingRevenueBreakdown(tenantId, start, end)
    const amount = receipts.reduce((sum, row) => sum + row.total_amount, 0)
    results.push({ month, label, amount })
  }

  return results
}

/* ── Payment method breakdown ─────────────────────────────────────── */

/**
 * Defaults to the last 12 months (unchanged from before `from`/`to` were
 * added) so the one existing caller that doesn't pass a range keeps
 * exactly today's behavior.
 */
export async function getPaymentMethodBreakdown(
  tenantId: string,
  from?: string,
  toExclusive?: string,
) {
  const start = from ?? monthStart(-11)
  const end = toExclusive ?? '9999-12-31T23:59:59.999Z'
  const receipts = await getBookingRevenueBreakdown(tenantId, start, end)

  const map: Record<string, { amount: number; count: number }> = {}
  for (const row of receipts) {
    const entry = map[row.method] ?? { amount: 0, count: 0 }
    entry.amount += row.total_amount
    entry.count  += row.transaction_count
    map[row.method] = entry
  }

  const total = Object.values(map).reduce((s, v) => s + v.amount, 0)

  return Object.entries(map)
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([method, v]) => ({
      method,
      amount: v.amount,
      count:  v.count,
      pct:    total > 0 ? Math.round((v.amount / total) * 100) : 0,
    }))
}

/**
 * Canonical accommodation-plus-folio outstanding balance across active
 * invoices whose check-in falls in the selected range.
 */
export async function getOutstandingBalance(tenantId: string, from?: string, to?: string): Promise<number> {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any).rpc('get_booking_outstanding_total', {
    p_tenant_id: tenantId,
    p_from: from?.slice(0, 10) ?? null,
    p_to: to?.slice(0, 10) ?? null,
  })
  if (error) throw new Error(`Could not load outstanding balance: ${error.message}`)
  return Number(data ?? 0)
}

/* ── Occupancy report ─────────────────────────────────────────────── */

export async function getOccupancyReport(tenantId: string) {
  const supabase = createAdminClient()

  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, status, housekeeping_status, category:room_categories(name)')
    .eq('tenant_id', tenantId)

  const total    = rooms?.length ?? 0
  const occupied = rooms?.filter((r) => r.status === 'occupied').length  ?? 0
  const reserved = rooms?.filter((r) => r.status === 'reserved').length  ?? 0
  const available= rooms?.filter((r) => r.status === 'available').length ?? 0

  // Category breakdown
  const catMap: Record<string, { total: number; occupied: number }> = {}
  for (const r of rooms ?? []) {
    const cat = Array.isArray(r.category) ? r.category[0] : r.category
    const name = (cat as any)?.name ?? 'Uncategorised'
    if (!catMap[name]) catMap[name] = { total: 0, occupied: 0 }
    catMap[name].total++
    if (r.status === 'occupied') catMap[name].occupied++
  }

  const byCategory = Object.entries(catMap).map(([name, v]) => ({
    name,
    total: v.total,
    occupied: v.occupied,
    pct: v.total > 0 ? Math.round((v.occupied / v.total) * 100) : 0,
  }))

  // HK status
  const hkMap: Record<string, number> = {}
  for (const r of rooms ?? []) {
    hkMap[r.housekeeping_status] = (hkMap[r.housekeeping_status] ?? 0) + 1
  }

  return {
    total,
    occupied,
    reserved,
    available,
    occupancyPct: total > 0 ? Math.round((occupied / total) * 100) : 0,
    byCategory,
    hkStatus: hkMap,
  }
}

/* ── Overdue rent ─────────────────────────────────────────────────── */

export async function getOverdueRent(tenantId: string) {
  const today = new Date().toISOString().slice(0, 10)
  const rows = await getBookingAgingRows(tenantId)

  return rows.filter((b) => (
    ['confirmed', 'checked_in'].includes(b.booking_status)
    && b.check_in_date < today
  )).map((b) => {
    const occupant = b.occupant_id ? {
      id: b.occupant_id,
      first_name: b.first_name,
      last_name: b.last_name,
      phone: b.phone,
      student_id: b.student_id,
    } : null
    const room = b.room_number ? { room_number: b.room_number, block: b.block } : null
    const balance = b.outstanding
    const daysOverdue = Math.floor(
      (Date.now() - new Date(b.check_in_date).getTime()) / 86_400_000
    )
    return {
      ...b,
      final_amount: b.invoice_total,
      paid_amount: b.invoice_received,
      occupant,
      room,
      balance,
      daysOverdue,
    }
  }).filter((booking) => booking.balance > 0)
}

/* ── Booking summary ──────────────────────────────────────────────── */

export async function getBookingSummary(tenantId: string) {
  const supabase = createAdminClient()

  const [{ data }, financials] = await Promise.all([
    supabase
    .from('bookings')
    .select('status, source')
    .eq('tenant_id', tenantId),
    getBookingFinancialSummary(tenantId),
  ])

  const rows = data ?? []
  const total = rows.length

  const byStatus: Record<string, number> = {}
  for (const b of rows) {
    byStatus[b.status] = (byStatus[b.status] ?? 0) + 1
  }

  const bySource: Record<string, number> = {}
  for (const b of rows) {
    const src = b.source ?? 'walk_in'
    bySource[src] = (bySource[src] ?? 0) + 1
  }

  return {
    total,
    byStatus,
    bySource,
    totalRevenue: financials.total_invoiced,
    totalPaid: financials.invoice_received,
    totalOutstanding: financials.outstanding,
    customerCredit: financials.customer_credit,
  }
}

/* ── Revenue management metrics (RevPAR, ADR, Yield) ─────────────── */

export interface RevenueMetricsMonth {
  month:        string   // 'YYYY-MM'
  label:        string   // 'Jan 2025'
  revenue:      number   // pesewas paid
  roomNights:   number   // total available room-nights (supply)
  bookedNights: number   // nights actually booked (demand)
  occupancyPct: number   // 0–100
  revpar:       number   // pesewas per available room-night
  adr:          number   // pesewas per booked room-night
  yieldPct:     number   // RevPAR / max possible RevPAR × 100
}

export async function getRevenueMetrics(tenantId: string, months = 6): Promise<RevenueMetricsMonth[]> {
  const supabase = createAdminClient()

  // Total rooms (supply denominator)
  const { count: totalRooms } = await supabase
    .from('rooms')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  const supply = totalRooms ?? 0

  // Max base rate (for yield ceiling)
  const { data: catRates } = await supabase
    .from('room_categories')
    .select('base_rate, rate_unit')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  // Normalise everything to a per-night rate (rough: semester=120d, month=30d, week=7d)
  const NIGHT_DIVISOR: Record<string, number> = { night: 1, week: 7, month: 30, semester: 120 }
  const maxNightlyRate = Math.max(
    1,
    ...(catRates ?? []).map((c) => Math.round(c.base_rate / (NIGHT_DIVISOR[c.rate_unit] ?? 30))),
  )

  const results: RevenueMetricsMonth[] = []

  for (let i = months - 1; i >= 0; i--) {
    const d    = new Date()
    d.setUTCMonth(d.getUTCMonth() - i)
    const year  = d.getUTCFullYear()
    const month = d.getUTCMonth()
    const label = d.toLocaleDateString('en-GH', { month: 'short', year: 'numeric' })
    const key   = `${year}-${String(month + 1).padStart(2, '0')}`

    const daysInMonth  = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const monthStartDt = new Date(Date.UTC(year, month, 1)).toISOString()
    const monthEndExclusive = new Date(Date.UTC(year, month + 1, 1)).toISOString()
    const monthEndDate = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10)

    // Revenue collected this month
    const receipts = await getBookingRevenueBreakdown(tenantId, monthStartDt, monthEndExclusive)
    const revenue = receipts.reduce((sum, row) => sum + row.total_amount, 0)

    // Booked nights: bookings that overlap this month
    const { data: bookings } = await supabase
      .from('bookings')
      .select('check_in_date, check_out_date')
      .eq('tenant_id', tenantId)
      .in('status', ['confirmed', 'checked_in', 'checked_out'])
      .lte('check_in_date', monthEndDate)
      .gte('check_out_date', monthStartDt.slice(0, 10))

    let bookedNights = 0
    for (const b of bookings ?? []) {
      const start = Math.max(new Date(b.check_in_date).getTime(),  Date.UTC(year, month, 1))
      const end   = Math.min(new Date(b.check_out_date).getTime(), Date.UTC(year, month + 1, 1))
      const nights = Math.max(0, Math.round((end - start) / 86_400_000))
      bookedNights += nights
    }

    const roomNights    = supply * daysInMonth
    const occupancyPct  = roomNights > 0 ? Math.round((bookedNights / roomNights) * 100) : 0
    const revpar        = roomNights > 0 ? Math.round(revenue / roomNights) : 0
    const adr           = bookedNights > 0 ? Math.round(revenue / bookedNights) : 0
    const maxRevpar     = maxNightlyRate  // ceiling = max nightly rate at 100% occ
    const yieldPct      = maxRevpar > 0 ? Math.min(100, Math.round((revpar / maxRevpar) * 100)) : 0

    results.push({ month: key, label, revenue, roomNights, bookedNights, occupancyPct, revpar, adr, yieldPct })
  }

  return results
}

/* ── YTD summary (for headline cards) ────────────────────────────── */

export async function getYtdSummary(tenantId: string) {
  const summary = await getBookingFinancialSummary(tenantId)
  return {
    ytdTotal: summary.ytd_recognized,
    mtdTotal: summary.mtd_recognized,
    overdueTotal: summary.overdue_outstanding,
  }
}
