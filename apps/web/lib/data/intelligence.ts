import { createAdminClient } from '@/lib/supabase/admin'

/* ── Live KPI strip ───────────────────────────────────────────────── */

export async function getIntelligenceKpis() {
  const supabase = createAdminClient()
  const today    = new Date().toISOString().slice(0, 10)
  const dayStart = `${today}T00:00:00.000Z`

  const [rooms, todayPayments, overdue] = await Promise.all([
    supabase.from('rooms').select('status'),
    supabase
      .from('booking_payments')
      .select('amount')
      .eq('status', 'paid')
      .gte('paid_at', dayStart),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .in('payment_status', ['unpaid', 'partial'])
      .lt('check_in_date', today)
      .in('status', ['confirmed', 'checked_in']),
  ])

  const allRooms  = rooms.data ?? []
  const total     = allRooms.length
  const occupied  = allRooms.filter((r) => r.status === 'occupied').length
  const available = allRooms.filter((r) => r.status === 'available').length

  const todayRevenue = (todayPayments.data ?? []).reduce((s, p) => s + p.amount, 0)

  return {
    total,
    occupied,
    available,
    occupancyPct: total > 0 ? Math.round((occupied / total) * 100) : 0,
    todayRevenue,
    overdueCount: overdue.count ?? 0,
  }
}

/* ── Activity feed from audit_log ─────────────────────────────────── */

export async function getActivityFeed(limit = 40) {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('audit_log')
    .select('id, action, entity_type, entity_id, description, actor_name, actor_role, occurred_at, new_values')
    .order('occurred_at', { ascending: false })
    .limit(limit)

  return data ?? []
}

/* ── Anomaly alerts (computed from live data) ─────────────────────── */

export async function getAnomalyAlerts() {
  const supabase = createAdminClient()
  const today    = new Date().toISOString().slice(0, 10)
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const [stale, overdue, outOfOrder, dirtyRooms] = await Promise.all([
    // Stale reservations: confirmed, unpaid, no action in 48h
    supabase
      .from('bookings')
      .select(`
        id, booking_ref, created_at, check_in_date,
        occupant:occupants(first_name, last_name),
        room:rooms(room_number)
      `)
      .eq('status', 'confirmed')
      .eq('payment_status', 'unpaid')
      .lt('created_at', fortyEightHoursAgo)
      .order('created_at', { ascending: true })
      .limit(10),

    // Overdue rent: active, past check-in, unpaid/partial
    supabase
      .from('bookings')
      .select(`
        id, booking_ref, check_in_date, final_amount, paid_amount,
        occupant:occupants(first_name, last_name),
        room:rooms(room_number)
      `)
      .in('payment_status', ['unpaid', 'partial'])
      .lt('check_in_date', today)
      .in('status', ['confirmed', 'checked_in'])
      .order('check_in_date', { ascending: true })
      .limit(10),

    // Out-of-order rooms
    supabase
      .from('rooms')
      .select('id, room_number, block, floor')
      .eq('housekeeping_status', 'out_of_order')
      .limit(10),

    // Dirty rooms (not being cleaned)
    supabase
      .from('rooms')
      .select('id, room_number, block, status')
      .eq('housekeeping_status', 'dirty')
      .limit(10),
  ])

  const alerts: {
    id: string
    severity: 'critical' | 'warning' | 'info'
    type: string
    title: string
    detail: string
    link?: string
  }[] = []

  for (const b of stale.data ?? []) {
    const occ  = Array.isArray(b.occupant) ? b.occupant[0] : b.occupant
    const room = Array.isArray(b.room)     ? b.room[0]     : b.room
    const hrs  = Math.floor((Date.now() - new Date(b.created_at).getTime()) / 3_600_000)
    alerts.push({
      id:       `stale-${b.id}`,
      severity: 'warning',
      type:     'Stale Reservation',
      title:    `${occ?.first_name ?? ''} ${occ?.last_name ?? ''} — no payment in ${hrs}h`,
      detail:   `Booking ${b.booking_ref} · Room ${room?.room_number ?? '—'} · Check-in ${b.check_in_date}`,
      link:     `/bookings/${b.id}`,
    })
  }

  for (const b of overdue.data ?? []) {
    const occ     = Array.isArray(b.occupant) ? b.occupant[0] : b.occupant
    const room    = Array.isArray(b.room)     ? b.room[0]     : b.room
    const balance = Math.max(0, b.final_amount - b.paid_amount)
    const days    = Math.floor((Date.now() - new Date(b.check_in_date).getTime()) / 86_400_000)
    alerts.push({
      id:       `overdue-${b.id}`,
      severity: days > 14 ? 'critical' : 'warning',
      type:     'Overdue Rent',
      title:    `${occ?.first_name ?? ''} ${occ?.last_name ?? ''} — GH₵${(balance / 100).toFixed(2)} unpaid`,
      detail:   `Room ${room?.room_number ?? '—'} · ${days} day${days !== 1 ? 's' : ''} overdue`,
      link:     `/bookings/${b.id}`,
    })
  }

  for (const r of outOfOrder.data ?? []) {
    alerts.push({
      id:       `oor-${r.id}`,
      severity: 'critical',
      type:     'Out of Order',
      title:    `Room ${r.room_number} is out of order`,
      detail:   [r.block ? `Block ${r.block}` : null, r.floor != null ? `Floor ${r.floor}` : null]
                  .filter(Boolean).join(' · ') || 'Requires maintenance before use',
      link:     `/housekeeping`,
    })
  }

  for (const r of dirtyRooms.data ?? []) {
    alerts.push({
      id:       `dirty-${r.id}`,
      severity: 'info',
      type:     'Needs Cleaning',
      title:    `Room ${r.room_number} is dirty`,
      detail:   r.status === 'available'
        ? 'Available room awaiting housekeeping'
        : 'Occupied room marked dirty — schedule cleaning',
      link:     `/housekeeping`,
    })
  }

  // Sort: critical first, then warning, then info
  const order = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => order[a.severity] - order[b.severity])

  return alerts
}

/* ── 30-day cash flow forecast ────────────────────────────────────── */

export async function getCashFlowForecast() {
  const supabase = createAdminClient()
  const today    = new Date().toISOString().slice(0, 10)
  const in30     = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)

  const { data } = await supabase
    .from('bookings')
    .select(`
      id, booking_ref, check_in_date, check_out_date,
      final_amount, paid_amount, payment_status, status,
      occupant:occupants(first_name, last_name),
      room:rooms(room_number)
    `)
    .gte('check_in_date', today)
    .lte('check_in_date', in30)
    .in('status', ['confirmed', 'pending_payment'])
    .order('check_in_date', { ascending: true })
    .limit(30)

  return (data ?? []).map((b) => {
    const occupant = Array.isArray(b.occupant) ? b.occupant[0] : b.occupant
    const room     = Array.isArray(b.room)     ? b.room[0]     : b.room
    const balance  = Math.max(0, b.final_amount - b.paid_amount)
    return { ...b, occupant, room, balance }
  })
}
