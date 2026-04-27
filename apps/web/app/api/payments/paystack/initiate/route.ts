import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { initiateMoMoCharge, type MoMoProvider } from '@/lib/paystack'

const schema = z.object({
  booking_id:  z.string().uuid(),
  amount:      z.number().int().positive(),   // pesewas
  phone:       z.string().min(9).max(15),
  provider:    z.enum(['mtn', 'vod', 'atl']),
  email:       z.string().email(),
})

const PROVIDER_METHOD: Record<string, string> = {
  mtn: 'momo_mtn',
  vod: 'momo_vodafone',
  atl: 'momo_airteltigo',
}

export async function POST(req: NextRequest) {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    return NextResponse.json({ error: 'Paystack is not configured. Add PAYSTACK_SECRET_KEY to .env.local.' }, { status: 503 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })

  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const supabase = createAdminClient()

  // Verify booking belongs to this tenant
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, booking_ref, final_amount, paid_amount')
    .eq('id', parsed.data.booking_id)
    .eq('tenant_id', tenantId)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  // Load the tenant's Paystack subaccount — required to route funds to the hostel bank
  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('paystack_subaccount_code')
    .eq('id', tenantId)
    .single()

  const subaccount = tenantRow?.paystack_subaccount_code ?? null
  if (!subaccount) {
    return NextResponse.json(
      { error: 'Online payments are not available yet. Connect a payout bank in Settings → Payouts.' },
      { status: 409 },
    )
  }

  // Create a pending payment record
  const { data: payment, error: paymentError } = await supabase
    .from('booking_payments')
    .insert({
      tenant_id:  tenantId,
      booking_id: parsed.data.booking_id,
      amount:     parsed.data.amount,
      method:     PROVIDER_METHOD[parsed.data.provider] as any,
      status:     'pending',
      reference:  null, // will be updated by webhook
    })
    .select('id')
    .single()

  if (paymentError || !payment) {
    return NextResponse.json({ error: 'Failed to create payment record' }, { status: 500 })
  }

  // Use payment ID as our reference (unique, traceable)
  const reference = `abr-${payment.id}`

  try {
    const result = await initiateMoMoCharge({
      email:          parsed.data.email,
      amountPesewas:  parsed.data.amount,
      phone:          parsed.data.phone,
      provider:       parsed.data.provider as MoMoProvider,
      reference,
      metadata: {
        tenant_id:       tenantId,
        booking_id:      parsed.data.booking_id,
        payment_id:      payment.id,
        booking_ref:     booking.booking_ref,
        source:          'staff_portal',
      },
      subaccount,
      bearer: 'subaccount',
    })

    // Store the Paystack reference on the payment record
    await supabase
      .from('booking_payments')
      .update({ reference: result.paystackReference })
      .eq('id', payment.id)

    return NextResponse.json({
      payment_id:   payment.id,
      reference,
      status:       result.status,
      display_text: result.displayText,
    })
  } catch (err: any) {
    // Clean up the pending payment record on failure
    await supabase.from('booking_payments').delete().eq('id', payment.id)
    return NextResponse.json({ error: err.message ?? 'Paystack error' }, { status: 502 })
  }
}
