import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({
  booking_ref:  z.string().min(1).max(50).toUpperCase(),
  phone:        z.string().min(9).max(20),
  title:        z.string().min(3).max(200),
  category:     z.enum(['plumbing', 'electrical', 'hvac', 'structural', 'furniture', 'appliance', 'cleaning', 'pest_control', 'security', 'other']),
  priority:     z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  description:  z.string().max(1000).optional().nullable(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data: tenant } = await admin
    .from('tenants')
    .select('id, name, is_active')
    .eq('slug', slug)
    .single()

  if (!tenant?.is_active) return NextResponse.json({ error: 'Hostel not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 422 })
  }

  const { booking_ref, phone, title, category, priority, description } = parsed.data

  // Verify booking + phone
  const { data: booking } = await admin
    .from('bookings')
    .select('id, room_id, status, occupants(phone)')
    .eq('tenant_id', tenant.id)
    .ilike('booking_ref', booking_ref)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  const occ = Array.isArray(booking.occupants) ? booking.occupants[0] : booking.occupants
  const normalise = (p: string) => p.replace(/\D/g, '').replace(/^233/, '0')
  if (!occ || normalise(occ.phone) !== normalise(phone)) {
    return NextResponse.json({ error: 'Phone does not match this booking' }, { status: 403 })
  }

  // Create maintenance request
  const { data: request, error } = await admin
    .from('maintenance_requests')
    .insert({
      tenant_id:   tenant.id,
      title,
      category,
      priority,
      description: description ?? null,
      room_id:     booking.room_id ?? null,
      status:      'open',
      source:      'occupant_portal',
    })
    .select('id, title, status, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, request }, { status: 201 })
}

// GET: fetch open requests for a booking
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { searchParams } = new URL(req.url)
  const bookingRef = searchParams.get('booking_ref')?.toUpperCase()
  const phone = searchParams.get('phone')

  if (!bookingRef || !phone) {
    return NextResponse.json({ error: 'booking_ref and phone required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: tenant } = await admin
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: booking } = await admin
    .from('bookings')
    .select('id, room_id, occupants(phone)')
    .eq('tenant_id', tenant.id)
    .ilike('booking_ref', bookingRef)
    .single()

  if (!booking) return NextResponse.json([])

  const occ = Array.isArray(booking.occupants) ? booking.occupants[0] : booking.occupants
  const normalise = (p: string) => p.replace(/\D/g, '').replace(/^233/, '0')
  if (!occ || normalise(occ.phone) !== normalise(phone)) return NextResponse.json([])

  const { data: requests } = await admin
    .from('maintenance_requests')
    .select('id, title, category, priority, status, created_at')
    .eq('tenant_id', tenant.id)
    .eq('room_id', booking.room_id)
    .not('status', 'in', '("completed","cancelled")')
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json(requests ?? [])
}
