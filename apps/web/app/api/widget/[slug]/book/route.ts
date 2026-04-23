import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { widgetCorsHeaders, corsPreflightResponse, checkOrigin } from '@/lib/widget-cors'
import { sendBookingConfirmation } from '@/lib/sms'

export const runtime = 'edge'

const schema = z.object({
  category_id:    z.string().uuid(),
  check_in_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  first_name:     z.string().min(1).max(100),
  last_name:      z.string().min(1).max(100),
  phone:          z.string().min(9).max(20),
  email:          z.string().email().optional().nullable(),
  institution:    z.string().max(200).optional().nullable(),
  student_id:     z.string().max(50).optional().nullable(),
  notes:          z.string().max(500).optional().nullable(),
})

export async function OPTIONS(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createAdminClient()
  const { data: tenant } = await supabase.from('tenants').select('widget_domains').eq('slug', slug).single()
  const cors = widgetCorsHeaders(req.headers.get('origin'), (tenant?.widget_domains ?? []) as string[])
  return corsPreflightResponse(cors)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const origin   = req.headers.get('origin')
  const supabase = createAdminClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, is_active, widget_domains')
    .eq('slug', slug)
    .single()

  if (!tenant || !tenant.is_active) {
    return NextResponse.json({ error: 'Hostel not found' }, { status: 404 })
  }

  const domains = (tenant.widget_domains ?? []) as string[]
  const cors    = widgetCorsHeaders(origin, domains)

  if (!checkOrigin(origin, domains)) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403, headers: cors })
  }

  const body   = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422, headers: cors })
  }

  const d = parsed.data

  // Verify category + availability
  const { data: category } = await supabase
    .from('room_categories')
    .select('id, name, base_rate, rate_unit, rooms(id, status)')
    .eq('id', d.category_id)
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .single()

  if (!category) {
    return NextResponse.json({ error: 'Room type not found' }, { status: 404, headers: cors })
  }

  const rooms = Array.isArray(category.rooms) ? category.rooms : []
  const availableRoom = rooms.find((r: any) => r.status === 'available')
  if (!availableRoom) {
    return NextResponse.json({ error: 'No rooms available in this category' }, { status: 409, headers: cors })
  }

  // Create or find occupant
  let occupantId: string
  const { data: existing } = await supabase
    .from('occupants')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('phone', d.phone)
    .maybeSingle()

  if (existing) {
    occupantId = existing.id
  } else {
    const { data: newOcc, error: occErr } = await supabase
      .from('occupants')
      .insert({
        tenant_id:   tenant.id,
        first_name:  d.first_name,
        last_name:   d.last_name,
        phone:       d.phone,
        email:       d.email,
        institution: d.institution,
        student_id:  d.student_id,
        status:      'pending',
        type:        d.institution ? 'student' : 'guest',
      })
      .select('id')
      .single()
    if (occErr || !newOcc) {
      return NextResponse.json({ error: 'Failed to create occupant record' }, { status: 500, headers: cors })
    }
    occupantId = newOcc.id
  }

  // Hold expires in 15 minutes (provisional booking)
  const holdExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  // Create booking
  const { data: booking, error: bookingErr } = await (supabase.from('bookings') as any)
    .insert({
      tenant_id:       tenant.id,
      occupant_id:     occupantId,
      room_id:         availableRoom.id,
      check_in_date:   d.check_in_date,
      check_out_date:  d.check_out_date,
      final_amount:    category.base_rate,
      paid_amount:     0,
      payment_status:  'unpaid',
      status:          'pending_payment',
      source:          'widget',
      notes:           d.notes,
      hold_expires_at: holdExpiresAt,
    })
    .select('id, booking_ref')
    .single()

  if (bookingErr || !booking) {
    return NextResponse.json({ error: bookingErr?.message ?? 'Booking failed' }, { status: 500, headers: cors })
  }

  // Mark room as reserved (hold, not full occupied yet)
  await (supabase.from('rooms') as any).update({ status: 'reserved' }).eq('id', availableRoom.id)

  // Send SMS confirmation (non-blocking)
  sendBookingConfirmation({
    phone:       d.phone,
    firstName:   d.first_name,
    bookingRef:  booking.booking_ref,
    roomNumber:  availableRoom.id,
    checkInDate: d.check_in_date,
    hostelName:  tenant.name,
    tenantId:    tenant.id,
  }).catch(() => {})

  return NextResponse.json({
    booking_ref:    booking.booking_ref,
    booking_id:     booking.id,
    room_type:      category.name,
    check_in_date:  d.check_in_date,
    check_out_date: d.check_out_date,
    amount:         category.base_rate,
    rate_unit:      category.rate_unit,
    status:         'pending_payment',
    hold_expires_at: holdExpiresAt,
  }, { status: 201, headers: cors })
}
