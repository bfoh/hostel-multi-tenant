import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Occupancy summary: total rooms, occupied rooms, pct.
 */
export async function getOccupancySummary() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('rooms')
    .select('status')

  if (error || !data) return { total: 0, occupied: 0, pct: 0 }

  const total = data.length
  const occupied = data.filter((r) => r.status === 'occupied').length
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0

  return { total, occupied, pct }
}

/**
 * Revenue this month and last month (in pesewas).
 */
export async function getRevenueStats() {
  const supabase = createAdminClient()

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString()

  const [thisMonthRes, lastMonthRes] = await Promise.all([
    supabase
      .from('booking_payments')
      .select('amount')
      .eq('status', 'success')
      .gte('paid_at', thisMonthStart),
    supabase
      .from('booking_payments')
      .select('amount')
      .eq('status', 'success')
      .gte('paid_at', lastMonthStart)
      .lte('paid_at', lastMonthEnd),
  ])

  const thisMonth = (thisMonthRes.data ?? []).reduce((sum, p) => sum + p.amount, 0)
  const lastMonth = (lastMonthRes.data ?? []).reduce((sum, p) => sum + p.amount, 0)
  const change = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0

  return { thisMonth, lastMonth, change }
}

/**
 * Booking stats: pending bookings, today's check-ins, today's check-outs.
 */
export async function getBookingStats() {
  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const [pendingRes, checkInsRes, checkOutsRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_payment'),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('check_in_date', today)
      .in('status', ['confirmed', 'checked_in']),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('check_out_date', today)
      .eq('status', 'checked_in'),
  ])

  return {
    pending: pendingRes.count ?? 0,
    todayCheckIns: checkInsRes.count ?? 0,
    todayCheckOuts: checkOutsRes.count ?? 0,
  }
}

/**
 * Alert count: overdue bookings (unpaid + check_in_date passed) + pending maintenance.
 */
export async function getAlertCount() {
  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { count } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('payment_status', 'unpaid')
    .lt('check_in_date', today)
    .in('status', ['confirmed', 'checked_in'])

  return count ?? 0
}

/**
 * Recent bookings for the activity list on the dashboard.
 */
export async function getRecentBookings(limit = 8) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id,
      booking_ref,
      status,
      payment_status,
      check_in_date,
      check_out_date,
      final_amount,
      source,
      created_at,
      occupant:occupants(first_name, last_name, phone),
      room:rooms(room_number, block, category:room_categories(name))
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []
  return data ?? []
}

/**
 * 7-day occupancy trend for the chart.
 */
export async function getOccupancyTrend() {
  const supabase = createAdminClient()

  // Get room count first
  const { data: rooms } = await supabase
    .from('rooms')
    .select('status')

  const totalRooms = rooms?.length ?? 0
  if (totalRooms === 0) return []

  // For each of the last 7 days, count bookings that were checked_in
  const days: { date: string; occupied: number; total: number; pct: number }[] = []

  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().slice(0, 10)

    const { count } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .lte('check_in_date', dateStr)
      .or(`check_out_date.gt.${dateStr},check_out_date.is.null`)
      .in('status', ['confirmed', 'checked_in', 'checked_out'])

    const occupied = count ?? 0
    days.push({
      date: dateStr,
      occupied,
      total: totalRooms,
      pct: Math.round((occupied / totalRooms) * 100),
    })
  }

  return days
}

/**
 * Setup checklist: which onboarding steps the tenant has completed.
 */
export async function getSetupChecklist() {
  const supabase = createAdminClient()

  const [categories, rooms, occupants, bookings] = await Promise.all([
    supabase.from('room_categories').select('id', { count: 'exact', head: true }),
    supabase.from('rooms').select('id', { count: 'exact', head: true }),
    supabase.from('occupants').select('id', { count: 'exact', head: true }),
    supabase.from('bookings').select('id', { count: 'exact', head: true }),
  ])

  return {
    hasCategory: (categories.count ?? 0) > 0,
    hasRoom:     (rooms.count ?? 0) > 0,
    hasOccupant: (occupants.count ?? 0) > 0,
    hasBooking:  (bookings.count ?? 0) > 0,
  }
}
