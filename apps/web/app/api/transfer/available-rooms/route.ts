import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { requireTenantRole } from '@/lib/auth/tenant-role'

export async function GET(request: NextRequest) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await requireTenantRole(tenantId, ['owner', 'manager', 'receptionist'])
  if (role instanceof NextResponse) return role

  const bookingId = request.nextUrl.searchParams.get('booking_id')
  if (!bookingId) {
    return NextResponse.json({ error: 'booking_id is required' }, { status: 422 })
  }

  const supabase = await createTenantAdminClientFromHeaders()
  const [{ data: booking }, { data: tenant }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, room_id, status, check_in_date, check_out_date')
      .eq('id', bookingId)
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase.from('tenants').select('business_type').eq('id', tenantId).maybeSingle(),
  ])

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  const effectiveCheckIn =
    booking.status === 'checked_in'
      ? new Date().toISOString().slice(0, 10)
      : booking.check_in_date

  const [{ data: rooms, error: roomsError }, { data: conflicts, error: conflictsError }] =
    await Promise.all([
      supabase
        .from('rooms')
        .select(
          'id, room_number, block, status, room_categories(name, base_rate, rate_unit, capacity)'
        )
        .eq('tenant_id', tenantId)
        .not('status', 'in', '(maintenance,blocked)')
        .order('room_number'),
      supabase
        .from('bookings')
        .select('id, room_id')
        .eq('tenant_id', tenantId)
        .neq('id', booking.id)
        .in('status', [
          'enquiry',
          'pending_confirmation',
          'pending_payment',
          'confirmed',
          'checked_in',
        ])
        .lt('check_in_date', booking.check_out_date)
        .gt('check_out_date', effectiveCheckIn),
    ])

  const queryError = roomsError ?? conflictsError
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 })

  const occupiedByRoom = new Map<string, number>()
  for (const conflict of conflicts ?? []) {
    occupiedByRoom.set(conflict.room_id, (occupiedByRoom.get(conflict.room_id) ?? 0) + 1)
  }

  const availableRooms = (rooms ?? []).filter((room) => {
    if (room.id === booking.room_id) return false
    const category = Array.isArray(room.room_categories)
      ? room.room_categories[0]
      : room.room_categories
    const capacity = tenant?.business_type === 'hotel' ? 1 : (category?.capacity ?? 1)
    return (occupiedByRoom.get(room.id) ?? 0) < capacity
  })

  return NextResponse.json(availableRooms)
}
