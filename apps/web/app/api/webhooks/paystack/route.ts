import { NextResponse, type NextRequest } from 'next/server'
import { createHmac } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/webhooks/paystack
 * Receives Paystack charge.success events.
 * Configure in Paystack dashboard: Settings → Webhooks → Add webhook URL.
 *
 * When a MoMo guest approves the USSD prompt, Paystack fires charge.success
 * with the reference we stored on the booking. We mark the booking as paid.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) return NextResponse.json({ ok: false }, { status: 503 })

  // Verify HMAC-SHA512 signature
  const signature  = req.headers.get('x-paystack-signature') ?? ''
  const rawBody    = await req.text()
  const expected   = createHmac('sha512', secret).update(rawBody).digest('hex')

  if (signature !== expected) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: any
  try { event = JSON.parse(rawBody) } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Only handle successful charges
  if (event.event !== 'charge.success') {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const reference = event.data?.reference
  const amountPesewas = event.data?.amount  // Paystack sends in smallest unit

  if (!reference) return NextResponse.json({ ok: true })

  const supabase = createAdminClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, tenant_id, final_amount, rooms(id)')
    .eq('paystack_reference', reference)
    .single()

  if (!booking) return NextResponse.json({ ok: true }) // unknown reference — ignore

  // Mark booking paid and room as occupied
  const updates: Record<string, unknown> = {
    payment_status: 'paid',
    paid_amount:    amountPesewas ?? booking.final_amount,
    status:         'confirmed',
  }

  await (supabase.from('bookings') as any)
    .update(updates)
    .eq('id', booking.id)

  // Log payment
  await (supabase.from('payments') as any).insert({
    tenant_id:  booking.tenant_id,
    booking_id: booking.id,
    amount:     amountPesewas ?? booking.final_amount,
    method:     'mobile_money',
    reference,
    status:     'completed',
    paid_at:    new Date().toISOString(),
  }).throwOnError().then(() => {})

  return NextResponse.json({ ok: true })
}
