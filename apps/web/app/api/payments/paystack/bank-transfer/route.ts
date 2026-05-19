/**
 * Staff-initiated Paystack bank-transfer charge for a booking.
 *
 * Returns a dedicated NUBAN account number that the guest transfers funds
 * to from any Ghana bank app. The unified Paystack webhook flips the
 * pre-inserted booking_payments row to `success` once Paystack settles
 * the transfer (matched via metadata.payment_id).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { initiateBankTransferCharge } from '@/lib/paystack'

const schema = z.object({
  booking_id: z.string().uuid(),
  amount:     z.number().int().positive(),    // pesewas
  email:      z.string().email().nullable().optional(),
})

const EXPIRY_MS = 30 * 60 * 1000 // 30 minutes

export async function POST(req: NextRequest) {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    return NextResponse.json({ error: 'Paystack is not configured.' }, { status: 503 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const supabase = createAdminClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, paystack_subaccount_code')
    .eq('id', tenantId)
    .single()

  if (!tenant?.paystack_subaccount_code) {
    return NextResponse.json(
      { error: 'Connect a payout bank in Settings → Payouts to take bank transfers.' },
      { status: 409 },
    )
  }

  const { data: bookingRaw } = await supabase
    .from('bookings')
    .select('id, booking_ref, final_amount, paid_amount, status, occupants(first_name, last_name, email)')
    .eq('id', parsed.data.booking_id)
    .eq('tenant_id', tenantId)
    .single()
  const booking = bookingRaw as any

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.status === 'cancelled') {
    return NextResponse.json({ error: 'Cannot charge a cancelled booking.' }, { status: 409 })
  }

  const balance = booking.final_amount - booking.paid_amount
  if (balance <= 0) return NextResponse.json({ error: 'Booking is already fully paid.' }, { status: 400 })

  const amount = Math.min(parsed.data.amount, balance)

  // Pre-insert a pending payment row so the webhook can flip it on success
  const { data: payment, error: paymentError } = await supabase
    .from('booking_payments')
    .insert({
      tenant_id:  tenantId,
      booking_id: parsed.data.booking_id,
      amount,
      method:     'bank_transfer' as any,
      status:     'pending',
      reference:  null,
    })
    .select('id')
    .single()

  if (paymentError || !payment) {
    return NextResponse.json({ error: 'Failed to create payment record' }, { status: 500 })
  }

  const reference = `bt-${payment.id}`
  const occ = Array.isArray(booking.occupants) ? booking.occupants[0] : booking.occupants
  const email = parsed.data.email ?? occ?.email ?? `${booking.booking_ref.toLowerCase()}@booking.local`
  const expiresAt = new Date(Date.now() + EXPIRY_MS).toISOString()

  try {
    const result = await initiateBankTransferCharge({
      email,
      amountPesewas: amount,
      reference,
      metadata: {
        source:       'staff_portal',
        tenant_id:    tenantId,
        booking_id:   parsed.data.booking_id,
        booking_ref:  booking.booking_ref,
        payment_id:   payment.id,
      },
      subaccount: tenant.paystack_subaccount_code,
      bearer:     'subaccount',
      expiresAt,
    })

    // Persist Paystack reference on payment row
    await supabase
      .from('booking_payments')
      .update({ reference: result.paystackReference })
      .eq('id', payment.id)

    return NextResponse.json({
      payment_id:     payment.id,
      reference,
      paystack_reference: result.paystackReference,
      status:         result.status,
      display_text:   result.displayText,
      account_number: result.accountNumber,
      account_name:   result.accountName,
      bank_name:      result.bankName,
      expires_at:     result.expiresAt ?? expiresAt,
      amount,
    })
  } catch (err: any) {
    // Drop the pending row on failure so the booking ledger stays clean
    await supabase.from('booking_payments').delete().eq('id', payment.id)
    return NextResponse.json({ error: err.message ?? 'Paystack error' }, { status: 502 })
  }
}
