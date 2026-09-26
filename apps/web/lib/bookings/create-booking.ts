import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Shared single-room booking creation, used by both the plain single
 * booking route (api/bookings/route.ts) and the group-booking route
 * (api/bookings/group/route.ts, which calls this once per room). Extracted
 * so room-capacity/rate/booking-ref logic lives in exactly one place —
 * duplicating booking-creation logic across two routes is exactly the kind
 * of drift risk that's bitten this codebase before.
 */

export interface CreateBookingParams {
  occupant_id:     string
  room_id:         string
  check_in_date:   string
  check_out_date:  string
  source:          'walk_in' | 'phone' | 'website' | 'widget' | 'voice_ai' | 'referral'
  semester?:       string | null
  academic_year?:  string | null
  discount_amount?: number
  discount_reason?: string | null
  notes?:          string | null
  group_id?:       string | null
}

export type CreateBookingResult =
  | { ok: true; bookingId: string; bookingRef: string; roomNumber: string | null }
  | { ok: false; status: number; error: string }

function generateBookingRef(): string {
  const year = new Date().getFullYear()
  const rand = Math.floor(Math.random() * 900000) + 100000
  return `ABR-${year}-${rand}`
}

export async function createBooking(
  supabase: SupabaseClient<any>,
  tenantId: string,
  params: CreateBookingParams,
): Promise<CreateBookingResult> {
  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .select('id, room_number, status, category:room_categories(base_rate, rate_unit, capacity)')
    .eq('id', params.room_id)
    .single()

  if (roomErr || !room) {
    return { ok: false, status: 404, error: 'Room not found.' }
  }

  if (room.status === 'maintenance' || room.status === 'blocked') {
    return { ok: false, status: 409, error: 'Room is not available for booking.' }
  }

  const category = Array.isArray(room.category) ? room.category[0] : room.category
  const baseRate = category?.base_rate ?? 0
  const capacity = category?.capacity ?? 1

  const { count: activeCount } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', params.room_id)
    .lte('check_in_date', params.check_out_date)
    .gte('check_out_date', params.check_in_date)
    .in('status', ['pending_payment', 'confirmed', 'checked_in'])

  if ((activeCount ?? 0) >= capacity) {
    return { ok: false, status: 409, error: `Room ${room.room_number} is fully booked for those dates.` }
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      tenant_id:       tenantId,
      booking_ref:     generateBookingRef(),
      occupant_id:     params.occupant_id,
      room_id:         params.room_id,
      check_in_date:   params.check_in_date,
      check_out_date:  params.check_out_date,
      source:          params.source,
      semester:        params.semester ?? null,
      academic_year:   params.academic_year ?? null,
      rate_per_unit:   baseRate,
      rate_unit:       category?.rate_unit ?? 'semester',
      total_amount:    baseRate,
      discount_amount: params.discount_amount ?? 0,
      discount_reason: params.discount_reason ?? null,
      tax_amount:      0,
      notes:           params.notes ?? null,
      status:          'pending_payment',
      group_id:        params.group_id ?? null,
    })
    .select('id, booking_ref')
    .single()

  if (error) {
    if (error.code === '23P01') {
      return { ok: false, status: 409, error: `Room ${room.room_number} is already booked for those dates.` }
    }
    return { ok: false, status: 500, error: error.message }
  }

  const newCount = (activeCount ?? 0) + 1
  const newRoomStatus = newCount >= capacity ? 'occupied' : 'reserved'
  await supabase.from('rooms').update({ status: newRoomStatus }).eq('id', params.room_id)

  return { ok: true, bookingId: data.id, bookingRef: data.booking_ref, roomNumber: room.room_number ?? null }
}
