import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  new_room_id: z.string().uuid(),
  reason:      z.string().max(500).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  // Fetch current booking
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, room_id, check_in_date, check_out_date, final_amount, rate_per_unit')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (!['confirmed', 'checked_in'].includes(booking.status))
    return NextResponse.json({ error: 'Can only transfer confirmed or checked-in bookings' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 422 })

  const { new_room_id, reason } = parsed.data

  if (new_room_id === booking.room_id)
    return NextResponse.json({ error: 'New room is the same as current room' }, { status: 400 })

  // Fetch new room details
  const { data: newRoom } = await supabase
    .from('rooms')
    .select('id, room_number, status, room_categories(name, base_rate, rate_unit)')
    .eq('id', new_room_id)
    .eq('tenant_id', tenantId)
    .single()

  if (!newRoom) return NextResponse.json({ error: 'New room not found' }, { status: 404 })
  if (newRoom.status === 'occupied')
    return NextResponse.json({ error: 'New room is already occupied' }, { status: 409 })
  if (newRoom.status === 'maintenance')
    return NextResponse.json({ error: 'New room is under maintenance' }, { status: 409 })

  // Check for conflicting bookings in the new room
  const { data: conflict } = await supabase
    .from('bookings')
    .select('id')
    .eq('room_id', new_room_id)
    .in('status', ['confirmed', 'checked_in'])
    .gte('check_out_date', booking.check_in_date)
    .lte('check_in_date', booking.check_out_date ?? '9999-12-31')
    .neq('id', id)
    .maybeSingle()

  if (conflict)
    return NextResponse.json({ error: 'New room has a conflicting booking for this period' }, { status: 409 })

  const cat = Array.isArray(newRoom.room_categories) ? newRoom.room_categories[0] : newRoom.room_categories

  // Update booking to new room, adjust rate if category changed
  const { data: updated, error } = await supabase
    .from('bookings')
    .update({
      room_id:       new_room_id,
      rate_per_unit: cat?.base_rate ?? booking.rate_per_unit,
      notes:         reason ? `[Room transfer → Room ${newRoom.room_number}] ${reason}` : `[Room transfer → Room ${newRoom.room_number}]`,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log to audit log
  await (supabase.from('audit_log') as any).insert({
    tenant_id:   tenantId,
    action:      'room_transfer',
    entity_type: 'bookings',
    entity_id:   id,
    new_values:  { old_room_id: booking.room_id, new_room_id, reason },
  }).throwOnError().then(() => {}).catch(() => {})

  return NextResponse.json({ booking: updated, new_room: newRoom })
}
