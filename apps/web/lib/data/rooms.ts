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
        id, name, type, base_rate, rate_unit, capacity, amenities, description, image_urls, is_active
      )
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) return null
  return data
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

  // Attach only active bookings to each room
  return (data ?? []).map((room) => {
    const bookings = Array.isArray(room.bookings) ? room.bookings : []
    const activeBooking = bookings.find(
      (b) =>
        b.check_in_date <= today &&
        (b.check_out_date == null || b.check_out_date >= today) &&
        ['confirmed', 'checked_in'].includes(b.status)
    )
    return { ...room, activeBooking: activeBooking ?? null }
  })
}
