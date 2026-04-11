import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const schema = z.object({
  booking_ref:        z.string().min(1),
  phone:              z.string().min(1),
  overall_rating:     z.number().int().min(1).max(5),
  cleanliness_rating: z.number().int().min(1).max(5).optional(),
  staff_rating:       z.number().int().min(1).max(5).optional(),
  value_rating:       z.number().int().min(1).max(5).optional(),
  would_recommend:    z.boolean().optional(),
  comments:           z.string().max(2000).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = createAdminClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 422 })

  // Verify booking ownership
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, occupant_id, occupants(phone)')
    .eq('tenant_id', tenant.id)
    .eq('booking_ref', parsed.data.booking_ref)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  const occupant = Array.isArray(booking.occupants) ? booking.occupants[0] : booking.occupants
  if (occupant?.phone !== parsed.data.phone)
    return NextResponse.json({ error: 'Phone number does not match' }, { status: 403 })

  if (booking.status !== 'checked_out')
    return NextResponse.json({ error: 'Feedback can only be submitted after check-out' }, { status: 400 })

  const { data, error } = await (supabase.from('occupant_feedback') as any)
    .upsert({
      tenant_id:          tenant.id,
      booking_id:         booking.id,
      occupant_id:        booking.occupant_id,
      overall_rating:     parsed.data.overall_rating,
      cleanliness_rating: parsed.data.cleanliness_rating ?? null,
      staff_rating:       parsed.data.staff_rating ?? null,
      value_rating:       parsed.data.value_rating ?? null,
      would_recommend:    parsed.data.would_recommend ?? null,
      comments:           parsed.data.comments ?? null,
      submitted_at:       new Date().toISOString(),
    }, { onConflict: 'booking_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
