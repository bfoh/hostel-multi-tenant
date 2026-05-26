import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { sendBookingConfirmation } from '@/lib/sms'
import { formatDate } from '@/lib/utils'

const schema = z.object({
  occupant_id:     z.string().uuid(),
  room_id:         z.string().uuid(),
  check_in_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source:          z.enum(['walk_in', 'phone', 'website', 'widget', 'voice_ai', 'referral']),
  semester:        z.string().optional().nullable(),
  academic_year:   z.string().optional().nullable(),
  discount_amount: z.number().int().min(0).default(0),
  discount_reason: z.string().max(200).optional().nullable(),
  notes:           z.string().max(500).optional().nullable(),
})

function generateBookingRef(): string {
  const year = new Date().getFullYear()
  const rand = Math.floor(Math.random() * 900000) + 100000
  return `ABR-${year}-${rand}`
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const tenantId = await getServerTenantId()
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 401 })
  }

  const supabase = await createTenantAdminClientFromHeaders()
  const d = parsed.data

  // Fetch room with category capacity
  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .select('id, status, category:room_categories(base_rate, rate_unit, capacity)')
    .eq('id', d.room_id)
    .single()

  if (roomErr || !room) {
    return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  }

  if (room.status === 'maintenance' || room.status === 'blocked') {
    return NextResponse.json({ error: 'Room is not available for booking.' }, { status: 409 })
  }

  const category = Array.isArray(room.category) ? room.category[0] : room.category
  const baseRate = category?.base_rate ?? 0
  const capacity = category?.capacity ?? 1

  // Count active overlapping bookings for this room
  const { count: activeCount } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', d.room_id)
    .lte('check_in_date', d.check_out_date)
    .gte('check_out_date', d.check_in_date)
    .in('status', ['pending_payment', 'confirmed', 'checked_in'])

  if ((activeCount ?? 0) >= capacity) {
    return NextResponse.json({ error: 'This room is fully booked for those dates.' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      tenant_id:       tenantId,
      booking_ref:     generateBookingRef(),
      occupant_id:     d.occupant_id,
      room_id:         d.room_id,
      check_in_date:   d.check_in_date,
      check_out_date:  d.check_out_date,
      source:          d.source,
      semester:        d.semester ?? null,
      academic_year:   d.academic_year ?? null,
      rate_per_unit:   baseRate,
      rate_unit:       category?.rate_unit ?? 'semester',
      total_amount:    baseRate,
      discount_amount: d.discount_amount,
      discount_reason: d.discount_reason ?? null,
      tax_amount:      0,
      notes:           d.notes ?? null,
      status:          'pending_payment',
    })
    .select('id, booking_ref')
    .single()

  if (error) {
    if (error.code === '23P01') {
      return NextResponse.json({ error: 'This room is already booked for those dates.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Update room status: occupied if now full, reserved if partially filled
  const newCount = (activeCount ?? 0) + 1
  const newRoomStatus = newCount >= capacity ? 'occupied' : 'reserved'
  await supabase.from('rooms').update({ status: newRoomStatus }).eq('id', d.room_id)

  // Fire SMS confirmation — non-blocking
  try {
    const [occupantRes, roomRes, tenantRes] = await Promise.all([
      supabase.from('occupants').select('first_name, phone').eq('id', d.occupant_id).single(),
      supabase.from('rooms').select('room_number').eq('id', d.room_id).single(),
      supabase.from('tenants').select('name').eq('id', tenantId).single(),
    ])
    if (occupantRes.data?.phone) {
      sendBookingConfirmation({
        phone:       occupantRes.data.phone,
        firstName:   occupantRes.data.first_name,
        bookingRef:  data.booking_ref,
        roomNumber:  roomRes.data?.room_number ?? '—',
        checkInDate: formatDate(d.check_in_date),
        hostelName:  tenantRes.data?.name ?? 'Your Hostel',
        tenantId,
      }).catch(() => {}) // swallow errors — SMS must never break booking creation
    }
  } catch { /* non-critical */ }

  return NextResponse.json(data, { status: 201 })
}
