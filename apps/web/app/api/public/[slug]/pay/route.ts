import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const initSchema = z.object({
  booking_ref: z.string().min(1),
  phone:       z.string().min(1),
  amount:      z.number().int().positive(),   // pesewas — must not exceed balance
})

// POST /api/public/[slug]/pay  → initialise Paystack transaction
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = createAdminClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('slug', slug)
    .single()

  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = initSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 422 })

  // Verify booking + phone
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, booking_ref, final_amount, paid_amount, status, occupants(phone, email, first_name, last_name)')
    .eq('tenant_id', tenant.id)
    .eq('booking_ref', parsed.data.booking_ref)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  const occ = Array.isArray(booking.occupants) ? booking.occupants[0] : booking.occupants
  if (occ?.phone !== parsed.data.phone)
    return NextResponse.json({ error: 'Phone number does not match' }, { status: 403 })

  if (booking.status === 'cancelled')
    return NextResponse.json({ error: 'Booking is cancelled' }, { status: 400 })

  const balance = booking.final_amount - booking.paid_amount
  if (balance <= 0)
    return NextResponse.json({ error: 'Booking is already fully paid' }, { status: 400 })

  const amount = Math.min(parsed.data.amount, balance)

  const paystackKey = process.env.PAYSTACK_SECRET_KEY
  if (!paystackKey)
    return NextResponse.json({ error: 'Online payment not configured' }, { status: 503 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`
  const callbackUrl = `${appUrl}/api/public/${slug}/pay/callback?booking_id=${booking.id}&amount=${amount}`

  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${paystackKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email:        occ?.email ?? `${booking.booking_ref.toLowerCase()}@portal.local`,
      amount,                          // already in pesewas = kobo for NGN but GHS uses same unit
      currency:     'GHS',
      reference:    `${booking.booking_ref}-${Date.now()}`,
      callback_url: callbackUrl,
      metadata: {
        booking_id:  booking.id,
        booking_ref: booking.booking_ref,
        tenant_id:   tenant.id,
        source:      'occupant_portal',
      },
    }),
  })

  const psData = await paystackRes.json()
  if (!psData.status) return NextResponse.json({ error: psData.message ?? 'Paystack error' }, { status: 502 })

  return NextResponse.json({
    authorization_url: psData.data.authorization_url,
    reference:         psData.data.reference,
    amount,
  })
}
