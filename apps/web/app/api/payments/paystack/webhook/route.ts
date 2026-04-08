import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyWebhookSignature } from '@/lib/paystack'

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-paystack-signature') ?? ''
  const rawBody = await req.text()

  // Verify the payload came from Paystack
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: { event: string; data: Record<string, any> }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // We only care about successful charges
  if (event.event !== 'charge.success') {
    return NextResponse.json({ ok: true })
  }

  const { reference, metadata } = event.data
  if (!metadata?.payment_id) {
    return NextResponse.json({ ok: true })
  }

  const supabase = await createClient()

  // Mark payment as success
  const { data: payment } = await supabase
    .from('booking_payments')
    .update({
      status:  'success',
      paid_at: new Date().toISOString(),
    })
    .eq('id', metadata.payment_id)
    .eq('status', 'pending')   // idempotent — only update if still pending
    .select('id, booking_id, amount')
    .single()

  if (payment) {
    // Trigger sync_booking_paid_amount via a no-op update (the DB trigger handles the rest)
    await supabase
      .from('bookings')
      .update({ updated_at: new Date().toISOString() } as any)
      .eq('id', payment.booking_id)
  }

  return NextResponse.json({ ok: true })
}

// Paystack requires the raw body for signature verification — disable Next.js body parsing
export const config = { api: { bodyParser: false } }
