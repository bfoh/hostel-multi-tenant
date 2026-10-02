import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { finalizeOnlineBookingPayment, notifyOnlinePayment } from '@/lib/payments/record-online-payment'

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

  // Resolve tenant from slug so we can verify the booking actually belongs to
  // the tenant whose public page initiated this payment. Without this check a
  // caller could record a payment against a booking from any tenant by
  // replacing the booking_id in the callback URL.
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (!tenant) return NextResponse.redirect(new URL(`/book/${slug}?pay=error`, req.url))

  // Fetch booking scoped to this tenant
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, tenant_id, paid_amount, final_amount, status')
    .eq('id', bookingId)
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  if (!booking) return NextResponse.redirect(new URL(`/book/${slug}?pay=error`, req.url))

  const { recorded } = await finalizeOnlineBookingPayment(supabase, {
    tenantId:  tenant.id,
    bookingId,
    amount,
    reference,
    method:    'card',
    notes:     'Paid online via Paystack hosted checkout',
  })

  if (recorded) {
    notifyOnlinePayment(supabase, { tenantId: tenant.id, bookingId, amount }).catch(() => {})
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`
  return NextResponse.redirect(new URL(`/book/${slug}?pay=success`, appUrl))
}
