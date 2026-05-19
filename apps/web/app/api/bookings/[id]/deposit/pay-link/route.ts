/**
 * Staff-issued Paystack pay link for a damage deposit.
 *
 * On success the row is written to `damage_deposits` by the unified Paystack
 * webhook (source='damage_deposit'). The callback at `pay-link/callback`
 * just verifies the charge and redirects the guest back.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { initializeTransaction } from '@/lib/paystack'
import { sendPaymentLink } from '@/lib/sms'

const schema = z.object({
  amount:   z.number().int().positive(),
  email:    z.string().email().nullable().optional(),
  send_sms: z.boolean().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return NextResponse.json({ error: 'Paystack is not configured.' }, { status: 503 })
  }

  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const supabase = createAdminClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, slug, name, paystack_subaccount_code')
    .eq('id', tenantId)
    .single()

  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  if (!tenant.paystack_subaccount_code) {
    return NextResponse.json(
      { error: 'Connect a payout bank in Settings → Payouts first.' },
      { status: 409 },
    )
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, booking_ref, occupant_id, status, occupants(first_name, last_name, phone, email)')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  // Block when a deposit already exists (matches POST /deposit semantics)
  const { data: existing } = await supabase
    .from('damage_deposits')
    .select('id')
    .eq('booking_id', id)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'A deposit is already recorded for this booking.' }, { status: 409 })
  }

  const occ = Array.isArray(booking.occupants) ? booking.occupants[0] : booking.occupants
  const email = parsed.data.email ?? occ?.email ?? `${booking.booking_ref.toLowerCase()}@booking.local`

  const host = req.headers.get('host') ?? 'localhost:3000'
  const proto = host.includes('localhost') ? 'http' : 'https'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`
  const callbackUrl = `${appUrl}/api/bookings/${id}/deposit/pay-link/callback?slug=${encodeURIComponent(tenant.slug)}`

  try {
    const result = await initializeTransaction({
      email,
      amountPesewas: parsed.data.amount,
      reference:     `dep-${booking.booking_ref}-${Date.now()}`,
      callbackUrl,
      channels:      ['card', 'mobile_money', 'bank', 'bank_transfer'],
      metadata: {
        source:        'damage_deposit',
        tenant_id:     tenant.id,
        booking_id:    id,
        booking_ref:   booking.booking_ref,
        occupant_id:   booking.occupant_id,
        deposit_amount: parsed.data.amount,
      },
      subaccount: tenant.paystack_subaccount_code,
      bearer:     'subaccount',
    })

    if (parsed.data.send_sms && occ?.phone) {
      sendPaymentLink({
        phone:      occ.phone,
        firstName:  occ.first_name ?? 'Guest',
        bookingRef: booking.booking_ref,
        amountGHS:  `GH₵ ${(parsed.data.amount / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`,
        url:        result.authorizationUrl,
        hostelName: tenant.name,
        tenantId,
      }).catch((err) => console.error('[deposit pay-link sms]', err))
    }

    return NextResponse.json({
      authorization_url: result.authorizationUrl,
      reference:         result.reference,
      amount:            parsed.data.amount,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Paystack error' }, { status: 502 })
  }
}
