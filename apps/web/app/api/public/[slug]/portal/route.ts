import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({
  booking_ref: z.string().min(1).max(50).toUpperCase(),
  phone:       z.string().min(9).max(20),
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
    return NextResponse.json({ error: 'Please enter a valid booking reference and phone number.' }, { status: 422 })
  }

  const { booking_ref, phone } = parsed.data

  // Look up booking — verify it belongs to this tenant and the occupant's phone matches
  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, booking_ref, status, payment_status,
      check_in_date, check_out_date,
      final_amount, paid_amount,
      semester, academic_year, notes, created_at,
      room:rooms(room_number, block, floor,
        category:room_categories(name, type)
      ),
      occupant:occupants(first_name, last_name, phone, email, institution, student_id),
      booking_payments(id, amount, method, reference, status, paid_at)
    `)
    .eq('tenant_id', tenant.id)
    .ilike('booking_ref', booking_ref)
    .single()

  if (!booking) {
    return NextResponse.json({ error: 'No booking found with that reference.' }, { status: 404 })
  }

  // Verify phone matches the occupant (prevents fishing for booking data)
  const occupant = Array.isArray(booking.occupant) ? booking.occupant[0] : booking.occupant
  const normalise = (p: string) => p.replace(/\D/g, '').replace(/^233/, '0')
  if (!occupant || normalise(occupant.phone) !== normalise(phone)) {
    return NextResponse.json({ error: 'Phone number does not match this booking.' }, { status: 403 })
  }

  return NextResponse.json({ booking, hostelName: tenant.name })
}
