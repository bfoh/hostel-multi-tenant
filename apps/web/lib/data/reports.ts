import { createClient } from '@/lib/supabase/server'

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

export async function getRevenueReport(months = 6) {
  const supabase = await createClient()

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
      .eq('status', 'success')
      .gte('paid_at', start)
      .lte('paid_at', end)

    const amount = (data ?? []).reduce((s, p) => s + p.amount, 0)
    results.push({ month, label, amount })
  }

  return results
}

/* ── Payment method breakdown ─────────────────────────────────────── */

export async function getPaymentMethodBreakdown() {
  const supabase = await createClient()
  const start = monthStart(-11) // last 12 months

  const { data } = await supabase
    .from('booking_payments')
    .select('method, amount')
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

export async function getOccupancyReport() {
  const supabase = await createClient()

  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, status, housekeeping_status, category:room_categories(name)')

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

export async function getOverdueRent() {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data } = await supabase
    .from('bookings')
    .select(`
      id, booking_ref, check_in_date, check_out_date,
      final_amount, paid_amount, payment_status,
      occupant:occupants(first_name, last_name, phone, student_id),
      room:rooms(room_number, block)
    `)
    .in('payment_status', ['unpaid', 'partial'])
    .lt('check_in_date', today)
    .in('status', ['confirmed', 'checked_in'])
    .order('check_in_date', { ascending: true })
    .limit(50)

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

export async function getBookingSummary() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('bookings')
    .select('status, payment_status, final_amount, paid_amount, source')

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

/* ── YTD summary (for headline cards) ────────────────────────────── */

export async function getYtdSummary() {
  const supabase = await createClient()
  const ytdStart = new Date(new Date().getFullYear(), 0, 1).toISOString()
  const mtdStart = monthStart(0)

  const [ytd, mtd, overdue] = await Promise.all([
    supabase
      .from('booking_payments')
      .select('amount')
      .eq('status', 'success')
      .gte('paid_at', ytdStart),
    supabase
      .from('booking_payments')
      .select('amount')
      .eq('status', 'success')
      .gte('paid_at', mtdStart),
    supabase
      .from('bookings')
      .select('final_amount, paid_amount')
      .in('payment_status', ['unpaid', 'partial'])
      .in('status', ['confirmed', 'checked_in']),
  ])

  const ytdTotal  = (ytd.data ?? []).reduce((s, p) => s + p.amount, 0)
  const mtdTotal  = (mtd.data ?? []).reduce((s, p) => s + p.amount, 0)
  const overdueTotal = (overdue.data ?? []).reduce(
    (s, b) => s + Math.max(0, b.final_amount - b.paid_amount),
    0
  )

  return { ytdTotal, mtdTotal, overdueTotal }
}
