import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/public/[slug]/pay/callback?trxref=...&reference=...&booking_id=...&amount=...
// Paystack redirects here after payment
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { searchParams } = req.nextUrl
  const reference = searchParams.get('reference') ?? searchParams.get('trxref')
  const bookingId = searchParams.get('booking_id')
  const amount    = parseInt(searchParams.get('amount') ?? '0', 10)

  if (!reference || !bookingId || !amount) {
    return NextResponse.redirect(new URL(`/book/${slug}?pay=error`, req.url))
  }

  const paystackKey = process.env.PAYSTACK_SECRET_KEY!

  // Verify transaction with Paystack
  const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${paystackKey}` },
  })
  const verifyData = await verifyRes.json()

  if (!verifyData.status || verifyData.data.status !== 'success') {
    return NextResponse.redirect(new URL(`/book/${slug}?pay=failed`, req.url))
  }

  const supabase = createAdminClient()

  // Fetch booking
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, tenant_id, paid_amount, final_amount, status')
    .eq('id', bookingId)
    .single()

  if (!booking) return NextResponse.redirect(new URL(`/book/${slug}?pay=error`, req.url))

  // Idempotency: check if reference already recorded
  const { data: existing } = await supabase
    .from('booking_payments')
    .select('id')
    .eq('paystack_reference', reference)
    .maybeSingle()

  if (!existing) {
    await supabase.from('booking_payments').insert({
      tenant_id:          booking.tenant_id,
      booking_id:         bookingId,
      amount,
      method:             'card',
      paystack_reference: reference,
      status:             'success',
      paid_at:            new Date().toISOString(),
      notes:              'Paid via occupant portal (Paystack)',
    })

    // Auto-confirm if fully paid
    const newPaid = booking.paid_amount + amount
    if (newPaid >= booking.final_amount && booking.status === 'pending_payment') {
      await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', bookingId)
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`
  return NextResponse.redirect(new URL(`/book/${slug}?pay=success`, appUrl))
}
