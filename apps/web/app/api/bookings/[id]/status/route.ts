import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  status: z.enum(['confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show']),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const nextStatus = parsed.data.status
  const supabase = await createClient()

  // Fetch current booking
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, room_id')
    .eq('id', id)
    .single()

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  const updatePayload: Record<string, unknown> = { status: nextStatus }

  if (nextStatus === 'checked_in') {
    updatePayload.actual_check_in = new Date().toISOString()
  } else if (nextStatus === 'checked_out') {
    updatePayload.actual_check_out = new Date().toISOString()
  } else if (nextStatus === 'cancelled') {
    updatePayload.cancelled_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('bookings')
    .update(updatePayload)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Sync room status based on remaining active bookings vs capacity
  if (booking.room_id) {
    const { data: roomData } = await supabase
      .from('rooms')
      .select('category:room_categories(capacity)')
      .eq('id', booking.room_id)
      .single()

    const cat = Array.isArray(roomData?.category) ? roomData?.category[0] : roomData?.category
    const capacity = cat?.capacity ?? 1

    // Count remaining active bookings (excluding the one just updated)
    const { count: remaining } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', booking.room_id)
      .neq('id', id)
      .in('status', ['pending_payment', 'confirmed', 'checked_in'])

    const activeRemaining = remaining ?? 0

    let roomStatus: string
    if (nextStatus === 'checked_in') {
      // This booking is now checked in — checked_in counts as active
      const totalActive = activeRemaining + 1
      roomStatus = totalActive >= capacity ? 'occupied' : 'reserved'
    } else if (nextStatus === 'checked_out' || nextStatus === 'cancelled' || nextStatus === 'no_show') {
      roomStatus = activeRemaining === 0 ? 'available' : activeRemaining >= capacity ? 'occupied' : 'reserved'
    } else {
      roomStatus = activeRemaining >= capacity ? 'occupied' : 'reserved'
    }

    await supabase.from('rooms').update({ status: roomStatus }).eq('id', booking.room_id)
  }

  return NextResponse.json({ ok: true })
}
