import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { widgetCorsHeaders, corsPreflightResponse, checkOrigin } from '@/lib/widget-cors'
import { paymentLimiter, enforceRateLimit } from '@/lib/rate-limit'

const schema = z.object({
  hostel_slug:    z.string().min(1),
  category_id:   z.string().uuid(),
  check_in_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  first_name:    z.string().min(1).max(100),
  last_name:     z.string().min(1).max(100),
  email:         z.string().email(),
  phone:         z.string().min(9).max(20),
  student_id:    z.string().max(50).nullable().optional(),
})

// NOTE: this no-slug route predates /api/widget/[slug]/book (which has a real
// Paystack integration, a 15-minute hold-expiry release, and correctly reuses
// lib/widget-cors.ts) and is not called by the shipped widget client
// (packages/widget/src/api.ts only calls the [slug] route). It previously had
// its own weaker CORS logic that reflected any Origin (or '*') regardless of
// the tenant's widget_domains whitelist. Its booking still hardcodes
// paystack_ref: null (no real payment completion) and never releases the
// room it reserves — that's a separate product question (should this route
// still exist at all?) left for a deliberate decision, not fixed here.
//
// A preflight OPTIONS request carries no body — the tenant (and therefore
// its domain whitelist) isn't knowable yet, since this route takes the slug
// in the JSON body rather than the URL like [slug]/book does. Allow the
// preflight generically; the real, domain-scoped gate is the origin check in
// POST below, which browsers still enforce against the OPTIONS response.
export async function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(widgetCorsHeaders(req.headers.get('origin'), []))
}

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(paymentLimiter, req, 'widget-book-legacy')
  if (limited) return limited

  const origin   = req.headers.get('origin')
  const supabase = createAdminClient()
  // Tenant (and its domain whitelist) isn't known until the body is parsed —
  // use the same "open" CORS shape (empty domains) for validation errors
  // that occur before that point, matching this route's prior behavior.
  const preTenantCors = widgetCorsHeaders(origin, [])

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: preTenantCors })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422, headers: preTenantCors })
  }

  const d = parsed.data

  // Resolve tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, widget_domains')
    .eq('slug', d.hostel_slug)
    .single()

  if (!tenant) {
    return NextResponse.json({ error: 'Hostel not found' }, { status: 404, headers: preTenantCors })
  }

  // CORS domain check — same shared, domain-scoped logic as [slug]/book
  // (previously this route reflected any Origin, or '*', ignoring the
  // tenant's widget_domains whitelist entirely).
  const domains: string[] = tenant.widget_domains ?? []
  const cors = widgetCorsHeaders(origin, domains)
  if (!checkOrigin(origin, domains)) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403, headers: cors })
  }

  // Find an available room in requested category
  const { data: room } = await supabase
    .from('rooms')
    .select('id, category_id')
    .eq('tenant_id', tenant.id)
    .eq('category_id', d.category_id)
    .eq('status', 'available')
    .limit(1)
    .single()

  if (!room) {
    return NextResponse.json({ error: 'No rooms available in that category' }, { status: 409, headers: cors })
  }

  // Get room rate
  const { data: category } = await supabase
    .from('room_categories')
    .select('base_rate')
    .eq('id', d.category_id)
    .single()

  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404, headers: cors })
  }

  // Find or create occupant
  let occupantId: string

  const { data: existingOcc } = await supabase
    .from('occupants')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('email', d.email)
    .maybeSingle()

  if (existingOcc) {
    occupantId = existingOcc.id
  } else {
    const { data: newOcc, error: occError } = await supabase
      .from('occupants')
      .insert({
        tenant_id:  tenant.id,
        first_name: d.first_name,
        last_name:  d.last_name,
        email:      d.email,
        phone:      d.phone,
        student_id: d.student_id ?? null,
      })
      .select('id')
      .single()

    if (occError || !newOcc) {
      return NextResponse.json({ error: 'Failed to create occupant record' }, { status: 500, headers: cors })
    }
    occupantId = newOcc.id
  }

  // Generate booking ref
  const { count } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)

  const seq = (count ?? 0) + 1
  const year = new Date().getFullYear()
  const booking_ref = `ABR-${year}-${String(seq).padStart(6, '0')}`

  // Create booking
  const { data: booking, error: bookingError } = await (supabase.from('bookings') as any)
    .insert({
      tenant_id:      tenant.id,
      occupant_id:    occupantId,
      room_id:        room.id,
      booking_ref,
      status:         'pending_payment',
      payment_status: 'unpaid',
      check_in_date:  d.check_in_date,
      check_out_date: d.check_out_date ?? null,
      source:         'widget',
      final_amount:   category.base_rate,
      paid_amount:    0,
    })
    .select('id, booking_ref, final_amount')
    .single()

  if (bookingError || !booking) {
    console.error('[POST /api/widget/book]', bookingError)
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500, headers: cors })
  }

  // Reserve the room
  await supabase
    .from('rooms')
    .update({ status: 'reserved' })
    .eq('id', room.id)

  return NextResponse.json(
    {
      booking_id:   booking.id,
      booking_ref:  booking.booking_ref,
      amount:       booking.final_amount,
      paystack_ref: null,   // Paystack integration point
    },
    { status: 201, headers: cors },
  )
}
