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
  amount:          z.number().int().min(1),
  method:          z.enum(PAYMENT_METHODS),
  reference:       z.string().max(100).optional().nullable(),
  notes:           z.string().max(300).optional().nullable(),
  idempotency_key: z.string().min(16).max(200),
})

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

  const { data, error } = await (supabase as any).rpc('record_booking_payment_idempotent', {
    p_tenant_id: tenantId,
    p_booking_id: id,
    p_amount: parsed.data.amount,
    p_method: parsed.data.method,
    p_reference: parsed.data.reference ?? null,
    p_notes: parsed.data.notes ?? null,
    p_actor_id: user.id,
    p_allow_overpayment: false,
    p_idempotency_key: parsed.data.idempotency_key,
  })

  if (error) {
    const duplicate = error.code === '23505'
    const conflict = duplicate || error.code === '22003' || error.code === '23514'
    return NextResponse.json({
      error: duplicate ? 'duplicate_payment' : error.message,
      ...(duplicate ? {
        message: `${error.message}. If this is a separate genuine payment, enter its unique transaction reference.`,
      } : {}),
    }, { status: conflict ? 409 : 500 })
  }

  // A transport retry receives the original result. Do not send a second
  // receipt or admin alert for an operation that did not create a new row.
  if (data?.recorded === false) {
    return NextResponse.json(data, { status: 200 })
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
    const balance   = Math.max(0, (bkn?.final_amount ?? 0) - (bkn?.paid_amount ?? 0))
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
