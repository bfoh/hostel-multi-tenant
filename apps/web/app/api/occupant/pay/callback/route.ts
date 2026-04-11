import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/occupant/pay/callback — Paystack redirects here after payment
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const reference = searchParams.get('reference') ?? searchParams.get('trxref')
  const bookingId = searchParams.get('booking_id')
  const amount    = parseInt(searchParams.get('amount') ?? '0', 10)

  const host   = req.headers.get('host') ?? 'localhost:3000'
  const proto  = host.includes('localhost') ? 'http' : 'https'
  const origin = `${proto}://${host}`

  if (!reference || !bookingId || !amount) {
    return NextResponse.redirect(new URL('/occupant-portal/payments?pay=error', origin))
  }

  const paystackKey = process.env.PAYSTACK_SECRET_KEY
  if (!paystackKey) {
    return NextResponse.redirect(new URL('/occupant-portal/payments?pay=error', origin))
  }

  // Verify with Paystack
  const verifyRes  = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${paystackKey}` },
  })
  const verifyData = await verifyRes.json()

  if (!verifyData.status || verifyData.data?.status !== 'success') {
    return NextResponse.redirect(new URL('/occupant-portal/payments?pay=failed', origin))
  }

  const admin = createAdminClient()

  const { data: booking } = await admin
    .from('bookings')
    .select('id, tenant_id, paid_amount, final_amount, status')
    .eq('id', bookingId)
    .single()

  if (!booking) {
    return NextResponse.redirect(new URL('/occupant-portal/payments?pay=error', origin))
  }

  // Idempotency: check reference not already recorded
  const { data: existing } = await admin
    .from('booking_payments')
    .select('id')
    .eq('paystack_reference', reference)
    .maybeSingle()

  if (!existing) {
    await admin.from('booking_payments').insert({
      tenant_id:          booking.tenant_id,
      booking_id:         bookingId,
      amount,
      method:             'card',
      paystack_reference: reference,
      status:             'success',
      paid_at:            new Date().toISOString(),
      notes:              'Paid via occupant portal (Paystack)',
    })

    const newPaid = booking.paid_amount + amount
    if (newPaid >= booking.final_amount && booking.status === 'pending_payment') {
      await admin.from('bookings').update({ status: 'confirmed' }).eq('id', bookingId)
    }
  }

  return NextResponse.redirect(new URL('/occupant-portal/payments?pay=success', origin))
}
