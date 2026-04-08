import { createClient } from '@/lib/supabase/server'

export async function getBookings(filter?: { status?: string; search?: string }) {
  const supabase = await createClient()

  let query = supabase
    .from('bookings')
    .select(`
      id, booking_ref, status, payment_status, source,
      check_in_date, check_out_date, final_amount, paid_amount, created_at,
      occupant:occupants(id, first_name, last_name, phone, student_id, institution),
      room:rooms(id, room_number, block, category:room_categories(name))
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (filter?.status && filter.status !== 'all') {
    query = query.eq('status', filter.status)
  }

  const { data, error } = await query
  if (error) return []
  return data ?? []
}

export async function getBookingById(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, booking_ref, status, payment_status, source, semester, academic_year,
      check_in_date, check_out_date, actual_check_in, actual_check_out,
      rate_per_unit, rate_unit, total_amount, discount_amount, discount_reason,
      tax_amount, final_amount, paid_amount, notes, created_at, updated_at,
      cancellation_reason, cancelled_at,
      occupant:occupants(
        id, first_name, last_name, other_names, phone, email, student_id,
        institution, programme, year_of_study, photo_url
      ),
      room:rooms(
        id, room_number, block, floor,
        category:room_categories(name, type, base_rate, rate_unit, capacity)
      ),
      booking_payments(
        id, amount, method, reference, paystack_reference, status, paid_at, notes
      )
    `)
    .eq('id', id)
    .single()

  if (error) return null
  return data
}

export async function getAvailableRooms(checkIn: string, checkOut: string) {
  const supabase = await createClient()

  // Count active bookings per room that overlap the requested period
  const { data: activeBookings } = await supabase
    .from('bookings')
    .select('room_id')
    .lte('check_in_date', checkOut)
    .gte('check_out_date', checkIn)
    .in('status', ['pending_payment', 'confirmed', 'checked_in'])

  // Build a map: room_id → active booking count
  const bookingCount: Record<string, number> = {}
  for (const b of activeBookings ?? []) {
    bookingCount[b.room_id] = (bookingCount[b.room_id] ?? 0) + 1
  }

  // Fetch all non-maintenance, non-blocked rooms with their category capacity
  const { data: rooms, error } = await supabase
    .from('rooms')
    .select(`
      id, room_number, block, floor, status,
      category:room_categories(id, name, type, base_rate, rate_unit, capacity, amenities)
    `)
    .not('status', 'in', '(maintenance,blocked)')
    .order('room_number')

  if (error) return []

  // Keep only rooms with remaining capacity
  return (rooms ?? []).filter((room) => {
    const cat = Array.isArray(room.category) ? room.category[0] : room.category
    const capacity = cat?.capacity ?? 1
    const booked = bookingCount[room.id] ?? 0
    return booked < capacity
  }).map((room) => {
    const cat = Array.isArray(room.category) ? room.category[0] : room.category
    const capacity = cat?.capacity ?? 1
    const booked = bookingCount[room.id] ?? 0
    return { ...room, spotsRemaining: capacity - booked }
  })
}
