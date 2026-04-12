import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendBookingConfirmation } from '@/lib/sms'
import { sendEmail, bookingConfirmationHtml } from '@/lib/email'

const schema = z.object({
  category_id: z.string().uuid(),
  check_in_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  first_name:  z.string().min(1).max(100),
  last_name:   z.string().min(1).max(100),
  phone:       z.string().min(9).max(20),
  email:       z.string().email().optional().nullable(),
  institution: z.string().max(200).optional().nullable(),
  student_id:  z.string().max(50).optional().nullable(),
  notes:       z.string().max(500).optional().nullable(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase = createAdminClient()

  // Resolve tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, is_active')
    .eq('slug', slug)
    .single()

  if (!tenant || !tenant.is_active) {
    return NextResponse.json({ error: 'Hostel not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const d = parsed.data

  // Verify category belongs to this tenant and has availability
  const { data: category } = await supabase
    .from('room_categories')
    .select('id, name, base_rate, rate_unit, rooms(id, status)')
    .eq('id', d.category_id)
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .single()

  if (!category) {
    return NextResponse.json({ error: 'Room type not found' }, { status: 404 })
  }

  const rooms = Array.isArray(category.rooms) ? category.rooms : []
  const availableRoom = rooms.find(r => r.status === 'available')

  if (!availableRoom) {
    return NextResponse.json({ error: 'No rooms available in this category' }, { status: 409 })
  }

  // Create or find occupant
  let occupantId: string

  const { data: existingOccupant } = await supabase
    .from('occupants')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('phone', d.phone)
    .maybeSingle()

  if (existingOccupant) {
    occupantId = existingOccupant.id
  } else {
    const { data: newOccupant, error: occupantError } = await supabase
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
        type:        d.institution ? 'student' : 'non_student',
      })
      .select('id')
      .single()

    if (occupantError || !newOccupant) {
      return NextResponse.json({ error: 'Failed to create occupant record' }, { status: 500 })
    }
    occupantId = newOccupant.id
  }

  // Create booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      tenant_id:      tenant.id,
      occupant_id:    occupantId,
      room_id:        availableRoom.id,
      check_in_date:  d.check_in_date,
      check_out_date: d.check_out_date,
      rate_per_unit:  category.base_rate,
      rate_unit:      category.rate_unit,
      total_amount:   category.base_rate,
      paid_amount:    0,
      payment_status: 'unpaid',
      status:         'pending_payment',
      source:         'online',
      notes:          d.notes,
    })
    .select('id, booking_ref')
    .single()

  if (bookingError || !booking) {
    return NextResponse.json({ error: bookingError?.message ?? 'Booking failed' }, { status: 500 })
  }

  // Mark room as occupied
  await supabase
    .from('rooms')
    .update({ status: 'occupied' })
    .eq('id', availableRoom.id)

  // Fetch tenant branding for email
  const { data: tenantFull } = await supabase
    .from('tenants')
    .select('primary_color, contact_phone')
    .eq('id', tenant.id)
    .single()

  const primaryColor = tenantFull?.primary_color ?? '#2563EB'

  // SMS confirmation (non-blocking)
  sendBookingConfirmation({
    phone:       d.phone,
    firstName:   d.first_name,
    bookingRef:  booking.booking_ref,
    roomNumber:  availableRoom.id,
    checkInDate: d.check_in_date,
    hostelName:  tenant.name,
  }).catch(() => {})

  // Email confirmation (non-blocking, only if email provided)
  if (d.email) {
    const formatDate = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('en-GH', { dateStyle: 'long' })
    const formatGHS  = (p: number) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(p / 100)
    sendEmail({
      to:      d.email,
      subject: `Booking received — ${tenant.name}`,
      html:    bookingConfirmationHtml({
        hostelName:   tenant.name,
        primaryColor,
        guestName:    `${d.first_name} ${d.last_name}`,
        bookingRef:   booking.booking_ref,
        roomName:     category.name,
        checkInDate:  formatDate(d.check_in_date),
        checkOutDate: formatDate(d.check_out_date),
        amountGHS:    formatGHS(category.base_rate),
        contactPhone: tenantFull?.contact_phone ?? undefined,
      }),
    }).catch(() => {})
  }

  return NextResponse.json({
    booking_ref:   booking.booking_ref,
    booking_id:    booking.id,
    room_type:     category.name,
    check_in_date: d.check_in_date,
    check_out_date: d.check_out_date,
    amount:        category.base_rate,
    rate_unit:     category.rate_unit,
    status:        'pending_payment',
  }, { status: 201 })
}
