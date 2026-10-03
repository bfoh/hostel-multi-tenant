import type { SupabaseClient } from '@supabase/supabase-js'

export interface ReassignBookingRoomInput {
  tenantId: string
  bookingId: string
  newRoomId: string
  reason?: string | null
  actorId: string
  expectedRoomId?: string | null
  expectedStatus?: string | null
}

export interface ReassignBookingRoomResult {
  changed: boolean
  id: string
  booking_ref?: string
  status: string
  previous_room_id?: string
  previous_room_number?: string
  room_id: string
  room_number?: string
  reason?: string
  room_assignment_source?: 'staff_reassignment'
  room_assigned_at?: string
}

/**
 * The sole application entry point for changing an existing booking's room.
 *
 * The database function locks the booking, validates tenant/status/capacity,
 * records the staff override, and writes the audit event atomically. Initial
 * automatic assignment is therefore replaced by one authoritative current
 * room instead of creating a second booking or leaving two active assignments.
 */
export async function reassignBookingRoom(
  supabase: SupabaseClient<any>,
  input: ReassignBookingRoomInput
): Promise<ReassignBookingRoomResult> {
  const { data, error } = await supabase.rpc('reassign_booking_room', {
    p_tenant_id: input.tenantId,
    p_booking_id: input.bookingId,
    p_new_room_id: input.newRoomId,
    p_reason: input.reason?.trim() || 'Room reassigned by staff',
    p_actor_id: input.actorId,
    p_expected_room_id: input.expectedRoomId ?? null,
    p_expected_status: input.expectedStatus ?? null,
  })

  if (error) throw new Error(error.message)

  const result = data as ReassignBookingRoomResult | null
  if (!result) throw new Error('Room reassignment returned no result')
  return result
}
