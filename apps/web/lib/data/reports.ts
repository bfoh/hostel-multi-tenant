import { createAdminClient } from '@/lib/supabase/admin'

/* ── helpers ──────────────────────────────────────────────────────── */

function monthStart(offset = 0) {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + offset, 1).toISOString()
}

function monthEnd(offset = 0) {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + offset + 1, 0, 23, 59, 59).toISOString()
}

/* ── Revenue report ───────────────────────────────────────────────── */

export async function getRevenueReport(tenantId: string, months = 6) {
  const supabase = createAdminClient()

  const results: { month: string; label: string; amount: number }[] = []

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const label = d.toLocaleDateString('en-GH', { month: 'short', year: 'numeric' })
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    const start = monthStart(-i)
    const end   = monthEnd(-i)

    const { data } = await supabase
      .from('booking_payments')
      .select('amount')
      .eq('tenant_id', tenantId)
      .eq('status', 'success')
      .gte('paid_at', start)
      .lte('paid_at', end)

    const amount = (data ?? []).reduce((s, p) => s + p.amount, 0)
    results.push({ month, label, amount })
  }

  return results
}

/* ── Payment method breakdown ─────────────────────────────────────── */

export async function getPaymentMethodBreakdown(tenantId: string) {
  const supabase = createAdminClient()
  const start = monthStart(-11) // last 12 months

  const { data } = await supabase
    .from('booking_payments')
    .select('method, amount')
    .eq('tenant_id', tenantId)
    .eq('status', 'success')
    .gte('paid_at', start)

  const map: Record<string, number> = {}
  for (const p of data ?? []) {
    map[p.method] = (map[p.method] ?? 0) + p.amount
  }

  const total = Object.values(map).reduce((s, v) => s + v, 0)

  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([method, amount]) => ({
      method,
      amount,
      pct: total > 0 ? Math.round((amount / total) * 100) : 0,
    }))
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
  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data } = await supabase
    .from('bookings')
    .select(`
      id, booking_ref, check_in_date, check_out_date,
      final_amount, paid_amount, payment_status,
      occupant:occupants(first_name, last_name, phone, student_id),
      room:rooms(room_number, block)
    `)
    .eq('tenant_id', tenantId)
    .in('payment_status', ['unpaid', 'partial'])
    .lt('check_in_date', today)
    .in('status', ['confirmed', 'checked_in'])
    .order('check_in_date', { ascending: true })

  return (data ?? []).map((b) => {
    const occupant = Array.isArray(b.occupant) ? b.occupant[0] : b.occupant
    const room     = Array.isArray(b.room)     ? b.room[0]     : b.room
    const balance  = Math.max(0, b.final_amount - b.paid_amount)
    const daysOverdue = Math.floor(
      (Date.now() - new Date(b.check_in_date).getTime()) / 86_400_000
    )
    return { ...b, occupant, room, balance, daysOverdue }
  })
}

/* ── Booking summary ──────────────────────────────────────────────── */

export async function getBookingSummary(tenantId: string) {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('bookings')
    .select('status, payment_status, final_amount, paid_amount, source')
    .eq('tenant_id', tenantId)

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

  const totalRevenue  = rows.reduce((s, b) => s + b.final_amount, 0)
  const totalPaid     = rows.reduce((s, b) => s + Math.min(b.paid_amount, b.final_amount), 0)
  const totalOutstanding = Math.max(0, totalRevenue - totalPaid)

  return { total, byStatus, bySource, totalRevenue, totalPaid, totalOutstanding }
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
    d.setMonth(d.getMonth() - i)
    const year  = d.getFullYear()
    const month = d.getMonth()
    const label = d.toLocaleDateString('en-GH', { month: 'short', year: 'numeric' })
    const key   = `${year}-${String(month + 1).padStart(2, '0')}`

    const daysInMonth  = new Date(year, month + 1, 0).getDate()
    const monthStartDt = new Date(year, month, 1).toISOString()
    const monthEndDt   = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

    // Revenue collected this month
    const { data: payments } = await supabase
      .from('booking_payments')
      .select('amount')
      .eq('tenant_id', tenantId)
      .eq('status', 'success')
      .gte('paid_at', monthStartDt)
      .lte('paid_at', monthEndDt)

    const revenue = (payments ?? []).reduce((s, p) => s + p.amount, 0)

    // Booked nights: bookings that overlap this month
    const { data: bookings } = await supabase
      .from('bookings')
      .select('check_in_date, check_out_date')
      .eq('tenant_id', tenantId)
      .in('status', ['confirmed', 'checked_in', 'checked_out'])
      .lte('check_in_date', monthEndDt.slice(0, 10))
      .gte('check_out_date', monthStartDt.slice(0, 10))

    let bookedNights = 0
    for (const b of bookings ?? []) {
      const start = Math.max(new Date(b.check_in_date).getTime(),  new Date(year, month, 1).getTime())
      const end   = Math.min(new Date(b.check_out_date).getTime(), new Date(year, month + 1, 0).getTime())
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
  const supabase = createAdminClient()
  const ytdStart = new Date(new Date().getFullYear(), 0, 1).toISOString()
  const mtdStart = monthStart(0)
  const today    = new Date().toISOString().slice(0, 10)

  const [ytd, mtd, overdue] = await Promise.all([
    supabase
      .from('booking_payments')
      .select('amount')
      .eq('tenant_id', tenantId)
      .eq('status', 'success')
      .gte('paid_at', ytdStart),
    supabase
      .from('booking_payments')
      .select('amount')
      .eq('tenant_id', tenantId)
      .eq('status', 'success')
      .gte('paid_at', mtdStart),
    supabase
      .from('bookings')
      .select('final_amount, paid_amount')
      .eq('tenant_id', tenantId)
      .in('payment_status', ['unpaid', 'partial'])
      .in('status', ['confirmed', 'checked_in'])
      .lt('check_in_date', today),
  ])

  const ytdTotal  = (ytd.data ?? []).reduce((s, p) => s + p.amount, 0)
  const mtdTotal  = (mtd.data ?? []).reduce((s, p) => s + p.amount, 0)
  const overdueTotal = (overdue.data ?? []).reduce(
    (s, b) => s + Math.max(0, b.final_amount - b.paid_amount),
    0
  )

  return { ytdTotal, mtdTotal, overdueTotal }
}
