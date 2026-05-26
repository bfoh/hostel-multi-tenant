import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { z } from 'zod'
import { requireTenantRole } from '@/lib/auth/tenant-role'

const schema = z.object({
  room_id: z.string().uuid(),
  reason:  z.string().max(500).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Validate session and role
  const roleCtx = await requireTenantRole(tenantId, ['owner', 'manager', 'receptionist'])
  if (roleCtx instanceof NextResponse) {
    return roleCtx
  }

  const supabase = await createTenantAdminClientFromHeaders()

  // Fetch current booking
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('id, status, room_id, check_in_date, check_out_date, notes')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (bookingErr || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  if (!['confirmed', 'checked_in', 'pending_payment'].includes(booking.status)) {
    return NextResponse.json({ error: 'Can only reassign pending, confirmed or checked-in bookings' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 422 })
  }

  const { room_id: new_room_id, reason } = parsed.data

  if (new_room_id === booking.room_id) {
    return NextResponse.json({ error: 'New room is the same as current room' }, { status: 400 })
  }

  // Fetch new room details
  const { data: newRoom, error: roomErr } = await supabase
    .from('rooms')
    .select('id, room_number, status, room_categories(base_rate, rate_unit, capacity)')
    .eq('id', new_room_id)
    .eq('tenant_id', tenantId)
    .single()

  if (roomErr || !newRoom) {
    return NextResponse.json({ error: 'New room not found' }, { status: 404 })
  }

  if (newRoom.status === 'maintenance' || newRoom.status === 'blocked') {
    return NextResponse.json({ error: 'New room is not available' }, { status: 409 })
  }

  const category = Array.isArray(newRoom.room_categories) ? newRoom.room_categories[0] : newRoom.room_categories
  const capacity = category?.capacity ?? 1

  // Check capacity for conflicting bookings in the new room
  const { count: activeCount } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', new_room_id)
    .in('status', ['pending_payment', 'confirmed', 'checked_in'])
    .lte('check_in_date', booking.check_out_date)
    .gte('check_out_date', booking.check_in_date)
    .neq('id', id)

  if ((activeCount ?? 0) >= capacity) {
    return NextResponse.json({ error: 'New room has no remaining capacity for this period' }, { status: 409 })
  }

  // Update booking to new room
  const updateNotes = reason 
    ? `[Room reassignment → Room ${newRoom.room_number}] ${reason}`
    : `[Room reassignment → Room ${newRoom.room_number}]`

  const finalNotes = booking.notes 
    ? `${booking.notes}\n${updateNotes}`
    : updateNotes

  const { data: updated, error: updateErr } = await supabase
    .from('bookings')
    .update({
      room_id: new_room_id,
      notes:   finalNotes,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // Update room status for the rooms
  // 1. New room occupancy count
  const newRoomCount = (activeCount ?? 0) + 1
  const newRoomStatus = newRoomCount >= capacity ? 'occupied' : 'reserved'
  await supabase.from('rooms').update({ status: newRoomStatus }).eq('id', new_room_id)

  // 2. Old room occupancy count (if there was an old room)
  if (booking.room_id) {
    const { count: oldRoomActiveCount } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', booking.room_id)
      .in('status', ['pending_payment', 'confirmed', 'checked_in'])
      .lte('check_in_date', booking.check_out_date)
      .gte('check_out_date', booking.check_in_date)
      .neq('id', id)

    const { data: oldRoom } = await supabase
      .from('rooms')
      .select('id, room_categories(capacity)')
      .eq('id', booking.room_id)
      .single()

    const oldCategory = Array.isArray(oldRoom?.room_categories) ? oldRoom?.room_categories[0] : oldRoom?.room_categories
    const oldCapacity = oldCategory?.capacity ?? 1
    const oldRoomCount = oldRoomActiveCount ?? 0
    let oldRoomStatus: 'available' | 'occupied' | 'reserved' = 'available'
    if (oldRoomCount >= oldCapacity) {
      oldRoomStatus = 'occupied'
    } else if (oldRoomCount > 0) {
      oldRoomStatus = 'reserved'
    }
    await supabase.from('rooms').update({ status: oldRoomStatus }).eq('id', booking.room_id)
  }

  // Log to audit log
  await (supabase.from('audit_log') as any).insert({
    tenant_id:   tenantId,
    action:      'booking.reassigned',
    entity_type: 'booking',
    entity_id:   id,
    new_values:  { old_room_id: booking.room_id, new_room_id, reason },
  }).throwOnError().then(() => {}).catch(() => {})

  return NextResponse.json({ booking: updated, new_room: newRoom })
}
