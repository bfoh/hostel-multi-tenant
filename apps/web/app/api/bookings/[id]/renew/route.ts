import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { z } from 'zod'
import { initBookingPayment } from '@/lib/booking-payment'
import { sendPaymentLink } from '@/lib/sms'

const schema = z.object({
  new_check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rate_per_unit:      z.number().int().positive().optional(),
  notes:              z.string().max(500).optional(),
  generate_pay_link:  z.boolean().optional(),
  send_sms:           z.boolean().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createTenantAdminClientFromHeaders()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, check_in_date, check_out_date, rate_per_unit, rate_unit, total_amount, discount_amount, tax_amount, final_amount, paid_amount, booking_ref, occupant_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  if (!['confirmed', 'checked_in', 'checked_out'].includes(booking.status))
    return NextResponse.json({ error: 'Only confirmed, checked-in or checked-out bookings can be renewed' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 422 })

  const newCheckOut = parsed.data.new_check_out_date
  if (newCheckOut <= (booking.check_out_date ?? '')) {
    return NextResponse.json({ error: 'New check-out date must be after current check-out date' }, { status: 400 })
  }

  const rate = parsed.data.rate_per_unit ?? booking.rate_per_unit

  // Recalculate total based on new period (simple: keep original total + extension amount)
  // Extension = from old checkout to new checkout
  const oldOut = new Date(booking.check_out_date ?? booking.check_in_date)
  const newOut = new Date(newCheckOut)
  const extraDays = Math.ceil((newOut.getTime() - oldOut.getTime()) / 86400000)

  // For semester/month rate units, keep original total; just extend dates
  // For night/week rate, add extension charge
  let extraAmount = 0
  if (booking.rate_unit === 'night') extraAmount = rate * extraDays
  else if (booking.rate_unit === 'week') extraAmount = rate * Math.ceil(extraDays / 7)
  // semester/month: extension is at same rate per period — keep original total (manual adjustment)

  const newTotal = booking.total_amount + extraAmount

  const { data: updated, error } = await supabase
    .from('bookings')
    .update({
      check_out_date: newCheckOut,
      status:         booking.status === 'checked_out' ? 'confirmed' : booking.status,
      rate_per_unit:  rate,
      total_amount:   newTotal,
      notes:          parsed.data.notes
        ? `[Renewal to ${newCheckOut}] ${parsed.data.notes}`
        : `[Renewal extended to ${newCheckOut}]`,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Optional: generate Paystack pay link for the new outstanding balance
  let payment: { authorization_url: string; reference: string; amount: number } | null = null

  if (parsed.data.generate_pay_link) {
    const newFinal = (updated.final_amount ?? updated.total_amount) as number
    const balance = newFinal - (updated.paid_amount ?? 0)

    if (balance > 0 && process.env.PAYSTACK_SECRET_KEY) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('slug, name, paystack_subaccount_code')
        .eq('id', tenantId)
        .single()

      if (tenant?.paystack_subaccount_code) {
        const { data: occ } = await supabase
          .from('occupants')
          .select('email, phone, first_name')
          .eq('id', booking.occupant_id)
          .single()

        const host = req.headers.get('host') ?? 'localhost:3000'
        const proto = host.includes('localhost') ? 'http' : 'https'
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`
        const callbackUrl = `${appUrl}/api/public/${tenant.slug}/pay/callback?booking_id=${id}&amount=${balance}`

        try {
          const result = await initBookingPayment({
            tenantId,
            tenantSubaccount: tenant.paystack_subaccount_code,
            bookingId:        id,
            bookingRef:       booking.booking_ref,
            amountPesewas:    balance,
            email:            occ?.email ?? null,
            callbackUrl,
            source:           'public_booking',
          })

          if (result) {
            payment = {
              authorization_url: result.authorizationUrl,
              reference:         result.reference,
              amount:            result.amount,
            }

            if (parsed.data.send_sms && occ?.phone) {
              sendPaymentLink({
                phone:      occ.phone,
                firstName:  occ.first_name ?? 'Guest',
                bookingRef: booking.booking_ref,
                amountGHS:  `GH₵ ${(balance / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`,
                url:        result.authorizationUrl,
                hostelName: tenant.name,
                tenantId,
              }).catch((err) => console.error('[renew pay-link sms]', err))
            }
          }
        } catch (err) {
          console.error('[POST /api/bookings/[id]/renew] pay-link init failed', err)
        }
      }
    }
  }

  return NextResponse.json({ ...updated, payment })
}
