/**
 * Staff-issued Paystack pay link for a booking.
 *
 * Generates a hosted-payment URL (card / momo / bank / bank_transfer channels)
 * that the receptionist can share with the guest via SMS / WhatsApp / copy.
 * No DB row is created up-front — the existing public callback at
 * `/api/public/[slug]/pay/callback` records the booking_payments row on
 * success, and the webhook handler flips it idempotently.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { initBookingPayment } from '@/lib/booking-payment'
import { sendPaymentLink } from '@/lib/sms'
import { sendEmail, invoicePayLinkHtml } from '@/lib/email'
import { paymentLimiter, enforceRateLimit } from '@/lib/rate-limit'

const schema = z.object({
  booking_id: z.string().uuid(),
  amount:     z.number().int().positive(),   // pesewas
  email:      z.string().email().nullable().optional(),
  send_sms:   z.boolean().optional(),
  send_email: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(paymentLimiter, req, 'paystack-pay-link')
  if (limited) return limited

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return NextResponse.json({ error: 'Paystack is not configured.' }, { status: 503 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const supabase = await createTenantAdminClientFromHeaders()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, slug, name, primary_color, logo_url, paystack_subaccount_code')
    .eq('id', tenantId)
    .single()

  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  if (!tenant.paystack_subaccount_code) {
    return NextResponse.json(
      { error: 'Connect a payout bank in Settings → Payouts to send pay links.' },
      { status: 409 },
    )
  }

  const { data: bookingRaw } = await supabase
    .from('bookings')
    .select('id, booking_ref, final_amount, paid_amount, status, occupants(first_name, last_name, phone, email)')
    .eq('id', parsed.data.booking_id)
    .eq('tenant_id', tenantId)
    .single()
  const booking = bookingRaw as any

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.status === 'cancelled') {
    return NextResponse.json({ error: 'Cannot generate pay link for a cancelled booking.' }, { status: 409 })
  }

  const balance = booking.final_amount - booking.paid_amount
  if (balance <= 0) return NextResponse.json({ error: 'Booking is already fully paid.' }, { status: 400 })

  const amount = Math.min(parsed.data.amount, balance)

  const occ = Array.isArray(booking.occupants) ? booking.occupants[0] : booking.occupants
  const email = parsed.data.email ?? occ?.email ?? null

  const host = req.headers.get('host') ?? 'localhost:3000'
  const proto = host.includes('localhost') ? 'http' : 'https'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`
  const callbackUrl = `${appUrl}/api/public/${tenant.slug}/pay/callback?booking_id=${booking.id}&amount=${amount}`

  try {
    const result = await initBookingPayment({
      tenantId:         tenant.id,
      tenantSubaccount: tenant.paystack_subaccount_code,
      bookingId:        booking.id,
      bookingRef:       booking.booking_ref,
      amountPesewas:    amount,
      email,
      callbackUrl,
      source:           'public_booking', // re-uses public callback semantics
    })

    if (!result) {
      return NextResponse.json({ error: 'Failed to initialize Paystack transaction.' }, { status: 502 })
    }

    const amountGHS = `GH₵ ${(amount / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`

    // Optional SMS to occupant
    if (parsed.data.send_sms && occ?.phone) {
      sendPaymentLink({
        phone:       occ.phone,
        firstName:   occ.first_name ?? 'Guest',
        bookingRef:  booking.booking_ref,
        amountGHS,
        url:         result.authorizationUrl,
        hostelName:  tenant.name,
        tenantId,
      }).catch((err) => console.error('[pay-link sms]', err))
    }

    // Optional email to occupant (or override email)
    const emailTarget = email && email.includes('@') ? email : occ?.email
    let emailSent = false
    if (parsed.data.send_email && emailTarget) {
      const invoiceNumber = (booking as any).invoice_number ?? booking.booking_ref
      emailSent = true
      sendEmail({
        to:         emailTarget,
        senderName: tenant.name,
        subject:    `Invoice ${invoiceNumber} — pay online`,
        html:       invoicePayLinkHtml({
          hostelName:    tenant.name,
          primaryColor:  (tenant as any).primary_color ?? '#2563EB',
          logoUrl:       (tenant as any).logo_url ?? null,
          guestName:     `${occ?.first_name ?? ''} ${occ?.last_name ?? ''}`.trim() || 'Guest',
          invoiceNumber,
          amountGHS,
          url:           result.authorizationUrl,
        }),
      }).catch((err) => {
        emailSent = false
        console.error('[pay-link email]', err)
      })
    }

    return NextResponse.json({
      authorization_url: result.authorizationUrl,
      reference:         result.reference,
      amount,
      sms_sent:          !!(parsed.data.send_sms && occ?.phone),
      email_sent:        emailSent,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Paystack error' }, { status: 502 })
  }
}
