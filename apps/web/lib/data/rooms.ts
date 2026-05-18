import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

export async function getRooms() {
  const tenantId = await getServerTenantId()
  if (!tenantId) return []

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('rooms')
    .select(`
      id,
      room_number,
      floor,
      block,
      status,
      housekeeping_status,
      notes,
      last_cleaned_at,
      created_at,
      updated_at,
      category:room_categories(
        id, name, type, base_rate, rate_unit, capacity, amenities, is_active
      )
    `)
    .eq('tenant_id', tenantId)
    .order('room_number', { ascending: true })

  if (error) return []
  return data ?? []
}

export async function getRoomById(id: string) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()

  const [{ data, error }, { data: occ }] = await Promise.all([
    supabase
      .from('rooms')
      .select(`
        id,
        room_number,
        floor,
        block,
        status,
        housekeeping_status,
        notes,
        last_cleaned_at,
        created_at,
        updated_at,
        category:room_categories(
          id, name, type, base_rate, rate_unit, capacity, amenities, description, image_urls, is_active
        )
      `)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase
      .from('room_occupancy_v')
      .select('beds_taken, free_beds, effective_status')
      .eq('room_id', id)
      .maybeSingle(),
  ])

  if (error || !data) return null

  return {
    ...data,
    bedsTaken:       (occ?.beds_taken       as number | undefined) ?? 0,
    freeBeds:        (occ?.free_beds        as number | undefined) ?? 0,
    effectiveStatus: (occ?.effective_status as string | undefined) ?? data.status,
  }
}

export async function getRoomCategories() {
  const tenantId = await getServerTenantId()
  if (!tenantId) return []

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('room_categories')
    .select('id, name, type, base_rate, rate_unit, capacity, amenities, is_active, sort_order')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('sort_order')

  if (error) return []
  return data ?? []
}

export async function getRoomsWithCurrentBooking() {
  const tenantId = await getServerTenantId()
  if (!tenantId) return []

  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('rooms')
    .select(`
      id,
      room_number,
      floor,
      block,
      status,
      housekeeping_status,
      category:room_categories(name, type, base_rate, rate_unit, capacity),
      bookings(
        id,
        booking_ref,
        status,
        check_in_date,
        check_out_date,
        payment_status,
        final_amount,
        occupant:occupants(first_name, last_name, phone)
      )
    `)
    .eq('tenant_id', tenantId)
    .order('room_number')

  if (error) return []

  const ACTIVE_BOOKING_STATUSES = new Set([
    'pending_confirmation',
    'confirmed',
    'checked_in',
  ])

  // Derive bed-level occupancy for each room. Effective status reflects
  // multi-occupancy: capacity-N rooms only flip to 'occupied' once all N beds
  // are filled. rooms.status is a manual override only (maintenance/blocked).
  return (data ?? []).map((room) => {
    const bookings = Array.isArray(room.bookings) ? room.bookings : []
    const cat = Array.isArray(room.category) ? room.category[0] : room.category
    const capacity = (cat?.capacity as number | undefined) ?? 1

    const activeBookings = bookings.filter(
      (b) =>
        ACTIVE_BOOKING_STATUSES.has(b.status as string) &&
        (b.check_out_date == null || b.check_out_date > today),
    )

    const inHouseBooking = activeBookings.find(
      (b) =>
        b.check_in_date <= today &&
        ['confirmed', 'checked_in'].includes(b.status as string),
    )

    const bedsTaken = activeBookings.length
    const freeBeds  = Math.max(0, capacity - bedsTaken)

    let effectiveStatus: string = room.status
    if (room.status !== 'maintenance' && room.status !== 'blocked') {
      if (bedsTaken >= capacity)      effectiveStatus = 'occupied'
      else if (bedsTaken > 0)         effectiveStatus = 'partial'
      else                            effectiveStatus = 'available'
    }

    return {
      ...room,
      activeBooking:   inHouseBooking ?? activeBookings[0] ?? null,
      activeBookings,
      capacity,
      bedsTaken,
      freeBeds,
      effectiveStatus,
    }
  })
}
