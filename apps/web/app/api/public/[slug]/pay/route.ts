import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import { initializeTransaction } from '@/lib/paystack'

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
    .select('id, name, paystack_subaccount_code')
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

  if (!process.env.PAYSTACK_SECRET_KEY)
    return NextResponse.json({ error: 'Online payment not configured' }, { status: 503 })

  if (!tenant.paystack_subaccount_code) {
    return NextResponse.json(
      { error: 'This hostel has not connected a payout bank yet. Please pay on arrival.' },
      { status: 409 },
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`
  const callbackUrl = `${appUrl}/api/public/${slug}/pay/callback?booking_id=${booking.id}&amount=${amount}`

  try {
    const result = await initializeTransaction({
      email:         occ?.email ?? `${booking.booking_ref.toLowerCase()}@portal.local`,
      amountPesewas: amount,
      reference:     `${booking.booking_ref}-${Date.now()}`,
      callbackUrl,
      channels:      ['card', 'mobile_money', 'bank', 'bank_transfer'],
      metadata: {
        booking_id:  booking.id,
        booking_ref: booking.booking_ref,
        tenant_id:   tenant.id,
        source:      'public_booking',
      },
      subaccount: tenant.paystack_subaccount_code,
      bearer:     'subaccount',
    })

    return NextResponse.json({
      authorization_url: result.authorizationUrl,
      reference:         result.reference,
      amount,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Paystack error' }, { status: 502 })
  }
}
