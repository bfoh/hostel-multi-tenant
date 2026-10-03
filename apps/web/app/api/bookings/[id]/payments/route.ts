import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { sendPaymentReceipt, sendAdminBookingAlert } from '@/lib/sms'
import { formatGHS } from '@/lib/utils'
import { sendEmail, paymentReceiptHtml, adminAlertHtml } from '@/lib/email'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from '@/lib/payments/methods'
import { getTenantAdminContacts } from '@/lib/notifications/admin-recipients'

const schema = z.object({
  amount:           z.number().int().min(1),
  method:           z.enum(PAYMENT_METHODS),
  reference:        z.string().max(100).optional().nullable(),
  notes:            z.string().max(300).optional().nullable(),
  confirmDuplicate: z.boolean().optional(),
})

// A manual entry has no reference to dedupe on (unlike online payments,
// which are protected by booking_payments.paystack_reference being unique)
// — this is the window within which an identical amount+method success on
// the same booking is treated as a likely accidental re-submission (e.g. a
// slow/failed response the staff member didn't see, prompting a retry)
// rather than a genuine second payment.
const DUPLICATE_WINDOW_MS = 3 * 60 * 1000

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const tenantId = await getServerTenantId()
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 401 })
  }

  // Authenticate caller (RLS-bound client just for auth.getUser)
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use admin client + explicit tenant scope so RLS can't 404 a valid booking
  // when JWT claims are stale (same pattern as POST /api/occupants).
  const supabase = await createTenantAdminClientFromHeaders()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, occupant_id, final_amount, paid_amount, status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  if (booking.status === 'cancelled') {
    return NextResponse.json({ error: 'Cannot record payment on a cancelled booking.' }, { status: 409 })
  }

  if (!parsed.data.confirmDuplicate) {
    const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString()
    const { data: recent } = await supabase
      .from('booking_payments')
      .select('id, paid_at')
      .eq('booking_id', id)
      .eq('amount', parsed.data.amount)
      .eq('method', parsed.data.method)
      .eq('status', 'success')
      .gte('paid_at', since)
      .order('paid_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (recent?.paid_at) {
      const secondsAgo = Math.max(1, Math.round((Date.now() - new Date(recent.paid_at).getTime()) / 1000))
      const methodLabel = PAYMENT_METHOD_LABEL[parsed.data.method] ?? parsed.data.method
      return NextResponse.json(
        {
          error: 'possible_duplicate',
          message: `A ${methodLabel} payment of ${formatGHS(parsed.data.amount)} was already recorded ${secondsAgo}s ago for this booking. Record this one anyway?`,
        },
        { status: 409 },
      )
    }
  }

  const { data, error } = await supabase
    .from('booking_payments')
    .insert({
      tenant_id:    tenantId,
      booking_id:   id,
      amount:       parsed.data.amount,
      method:       parsed.data.method,
      reference:    parsed.data.reference ?? null,
      notes:        parsed.data.notes ?? null,
      status:       'success',
      paid_at:      new Date().toISOString(),
      received_by:  user.id,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Check if fully paid — auto-confirm if was pending_payment
  const newPaidAmount = booking.paid_amount + parsed.data.amount
  if (newPaidAmount >= booking.final_amount && booking.status === 'pending_payment') {
    await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', id)
  }

  // Fire SMS + email receipt — non-blocking
  try {
    const [occupantRes, bookingRes, tenantRes] = await Promise.all([
      supabase.from('occupants').select('first_name, last_name, phone, email').eq('id', booking.occupant_id).single(),
      supabase.from('bookings').select('booking_ref, final_amount, paid_amount').eq('id', id).single(),
      supabase.from('tenants').select('name, primary_color, logo_url').eq('id', tenantId).single(),
    ])

    const occ       = occupantRes.data
    const bkn       = bookingRes.data
    const ten       = tenantRes.data
    const balance   = Math.max(0, (bkn?.final_amount ?? 0) - ((bkn?.paid_amount ?? 0) + parsed.data.amount))
    const methodLabel = PAYMENT_METHOD_LABEL[parsed.data.method] ?? parsed.data.method

    if (occ?.phone) {
      sendPaymentReceipt({
        phone:      occ.phone,
        firstName:  occ.first_name,
        amountGHS:  formatGHS(parsed.data.amount),
        method:     methodLabel,
        bookingRef: bkn?.booking_ref ?? id,
        balance:    formatGHS(balance),
        hostelName: ten?.name ?? 'Your Property',
        tenantId,
      }).catch(() => {})
    }

    if (occ?.email && ten) {
      sendEmail({
        to:         occ.email,
        senderName: ten.name,
        subject:    `Payment receipt — ${ten.name}`,
        html:    paymentReceiptHtml({
          hostelName:   ten.name,
          primaryColor: ten.primary_color ?? '#2563EB',
          logoUrl:      (ten as any).logo_url ?? null,
          guestName:    `${occ.first_name} ${occ.last_name}`,
          bookingRef:   bkn?.booking_ref ?? id.slice(0, 8).toUpperCase(),
          amountGHS:    formatGHS(parsed.data.amount),
          method:       methodLabel,
          paidAt:       new Date().toLocaleDateString('en-GH', { dateStyle: 'long' }),
          balance:      formatGHS(balance),
        }),
      }).catch(() => {})
    }

    // Owner/admin alert (non-blocking)
    if (ten) {
      const admins = await getTenantAdminContacts(supabase, tenantId)
      const eventLine = `Payment of ${formatGHS(parsed.data.amount)} received from ${occ ? `${occ.first_name} ${occ.last_name}` : 'a guest'} via ${methodLabel} (${bkn?.booking_ref ?? id})`

      if (admins.smsEnabled) {
        for (const phone of admins.phones) {
          sendAdminBookingAlert({ phone, hostelName: ten.name, eventLine, tenantId }).catch(() => {})
        }
      }
      if (admins.emailEnabled) {
        for (const email of admins.emails) {
          sendEmail({
            to:         email,
            senderName: ten.name,
            subject:    `Payment received — ${bkn?.booking_ref ?? id}`,
            html:    adminAlertHtml({
              hostelName:   ten.name,
              primaryColor: ten.primary_color ?? '#2563EB',
              logoUrl:      (ten as any).logo_url ?? null,
              title:        'Payment recorded',
              lines: [
                { label: 'Guest',   value: occ ? `${occ.first_name} ${occ.last_name}` : 'Guest' },
                { label: 'Amount',  value: formatGHS(parsed.data.amount) },
                { label: 'Method',  value: methodLabel },
                { label: 'Booking', value: bkn?.booking_ref ?? id },
                { label: 'Balance', value: formatGHS(balance) },
              ],
            }),
          }).catch(() => {})
        }
      }
    }
  } catch { /* non-critical */ }

  return NextResponse.json(data, { status: 201 })
}
