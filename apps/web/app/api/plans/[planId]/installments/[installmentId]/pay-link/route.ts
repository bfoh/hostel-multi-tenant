/**
 * Staff-issued Paystack pay link for a single installment.
 *
 * On success the unified Paystack webhook (source='installment') marks the
 * installment paid and bumps booking.paid_amount.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { initializeTransaction } from '@/lib/paystack'
import { sendPaymentLink } from '@/lib/sms'
import { paymentLimiter, enforceRateLimit } from '@/lib/rate-limit'

const schema = z.object({
  email:    z.string().email().nullable().optional(),
  send_sms: z.boolean().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string; installmentId: string }> },
) {
  const { planId, installmentId } = await params

  const limited = await enforceRateLimit(paymentLimiter, req, 'installment-pay-link')
  if (limited) return limited

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return NextResponse.json({ error: 'Paystack is not configured.' }, { status: 503 })
  }

  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body ?? {})
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const supabase = await createTenantAdminClientFromHeaders()

  // Load installment + plan + booking + tenant in parallel where independent
  const { data: installment } = await supabase
    .from('payment_plan_installments')
    .select('id, plan_id, amount, status, installment_number')
    .eq('id', installmentId)
    .eq('plan_id', planId)
    .eq('tenant_id', tenantId)
    .single()

  if (!installment) return NextResponse.json({ error: 'Installment not found' }, { status: 404 })
  if (installment.status === 'paid') {
    return NextResponse.json({ error: 'Installment already paid.' }, { status: 409 })
  }
  if (installment.status === 'waived') {
    return NextResponse.json({ error: 'Installment is waived.' }, { status: 409 })
  }

  const { data: plan } = await supabase
    .from('payment_plans')
    .select('id, booking_id')
    .eq('id', planId)
    .eq('tenant_id', tenantId)
    .single()
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, booking_ref, occupant_id, occupants(first_name, last_name, phone, email)')
    .eq('id', plan.booking_id)
    .eq('tenant_id', tenantId)
    .single()
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('slug, name, paystack_subaccount_code')
    .eq('id', tenantId)
    .single()
  if (!tenant?.paystack_subaccount_code) {
    return NextResponse.json(
      { error: 'Connect a payout bank in Settings → Payouts first.' },
      { status: 409 },
    )
  }

  // payment_plan_installments.amount is stored as numeric (decimal cedis).
  // Paystack works in pesewas → multiply by 100.
  const amountPesewas = Math.round(Number(installment.amount) * 100)
  if (!Number.isFinite(amountPesewas) || amountPesewas <= 0) {
    return NextResponse.json({ error: 'Invalid installment amount.' }, { status: 400 })
  }

  const occ   = Array.isArray(booking.occupants) ? booking.occupants[0] : booking.occupants
  const email = parsed.data.email ?? occ?.email ?? `${booking.booking_ref.toLowerCase()}@booking.local`

  const host  = req.headers.get('host') ?? 'localhost:3000'
  const proto = host.includes('localhost') ? 'http' : 'https'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`
  const callbackUrl = `${appUrl}/api/plans/${planId}/installments/${installmentId}/pay-link/callback?slug=${encodeURIComponent(tenant.slug)}`

  try {
    const result = await initializeTransaction({
      email,
      amountPesewas,
      reference:     `ins-${installment.id}-${Date.now()}`,
      callbackUrl,
      channels:      ['card', 'mobile_money', 'bank', 'bank_transfer'],
      metadata: {
        source:         'installment',
        tenant_id:      tenantId,
        plan_id:        planId,
        installment_id: installment.id,
        booking_id:     booking.id,
        booking_ref:    booking.booking_ref,
        amount:         amountPesewas,
      },
      subaccount: tenant.paystack_subaccount_code,
      bearer:     'subaccount',
    })

    if (parsed.data.send_sms && occ?.phone) {
      sendPaymentLink({
        phone:      occ.phone,
        firstName:  occ.first_name ?? 'Guest',
        bookingRef: `${booking.booking_ref} #${installment.installment_number}`,
        amountGHS:  `GH₵ ${(amountPesewas / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`,
        url:        result.authorizationUrl,
        hostelName: tenant.name,
        tenantId,
      }).catch((err) => console.error('[installment pay-link sms]', err))
    }

    return NextResponse.json({
      authorization_url: result.authorizationUrl,
      reference:         result.reference,
      amount:            amountPesewas,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Paystack error' }, { status: 502 })
  }
}
