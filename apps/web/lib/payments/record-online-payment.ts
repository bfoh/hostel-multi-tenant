import type { SupabaseClient } from '@supabase/supabase-js'
import type { PaymentMethod } from '@/lib/payments/methods'
import { sendPaymentReceipt, sendAdminBookingAlert } from '@/lib/sms'
import { sendEmail, paymentReceiptHtml, adminAlertHtml } from '@/lib/email'
import { formatGHS } from '@/lib/utils'
import { getTenantAdminContacts } from '@/lib/notifications/admin-recipients'

/**
 * Idempotently records an online (Paystack) payment against a booking and
 * auto-confirms it when fully paid — the logic that was duplicated almost
 * verbatim between app/api/public/[slug]/pay/callback and
 * app/api/occupant/pay/callback. Returns `recorded: false` when the
 * reference was already processed, so callers only fire notifications once
 * even if both the redirect callback and the webhook race for the same
 * payment.
 */
export async function finalizeOnlineBookingPayment(
  supabase: SupabaseClient<any>,
  params: {
    tenantId: string
    bookingId: string
    amount: number
    reference: string
    method?: PaymentMethod
    notes?: string
  }
): Promise<{ recorded: boolean; requiresResolution?: boolean }> {
  const { data, error } = await (supabase as any).rpc('finalize_online_booking_payment', {
    p_tenant_id: params.tenantId,
    p_booking_id: params.bookingId,
    p_amount: params.amount,
    p_reference: params.reference,
    p_method: params.method ?? 'card',
    p_notes: params.notes ?? 'Paid online via Paystack',
  })

  if (error) throw new Error(`Could not record online payment: ${error.message}`)

  return {
    recorded: Boolean(data?.recorded),
    requiresResolution: Boolean(data?.requires_resolution) || undefined,
  }
}

/**
 * Guest receipt (SMS + email, same templates the manual/staff-recorded
 * payment route already uses) plus an owner/admin alert. Call only after
 * `finalizeOnlineBookingPayment` reports `recorded: true`.
 */
export async function notifyOnlinePayment(
  supabase: SupabaseClient<any>,
  params: { tenantId: string; bookingId: string; amount: number; requiresResolution?: boolean }
): Promise<void> {
  try {
    const [occupantRes, bookingRes, tenantRes, admins] = await Promise.all([
      supabase
        .from('bookings')
        .select('occupant:occupants(first_name, last_name, phone, email)')
        .eq('id', params.bookingId)
        .single(),
      supabase
        .from('bookings')
        .select('booking_ref, final_amount, paid_amount')
        .eq('id', params.bookingId)
        .single(),
      supabase
        .from('tenants')
        .select('name, primary_color, logo_url')
        .eq('id', params.tenantId)
        .single(),
      getTenantAdminContacts(supabase, params.tenantId),
    ])

    const occRaw = (occupantRes.data as any)?.occupant
    const occ = Array.isArray(occRaw) ? occRaw[0] : occRaw
    const bkn = bookingRes.data
    const ten = tenantRes.data
    const balance = Math.max(0, (bkn?.final_amount ?? 0) - (bkn?.paid_amount ?? 0))
    const guestName = occ ? `${occ.first_name} ${occ.last_name}` : 'Guest'
    const bookingRef = bkn?.booking_ref ?? params.bookingId.slice(0, 8).toUpperCase()
    const amountGHS = formatGHS(params.amount)

    if (admins.smsEnabled && occ?.phone) {
      sendPaymentReceipt({
        phone: occ.phone,
        firstName: occ.first_name,
        amountGHS,
        method: 'Online',
        bookingRef,
        balance: formatGHS(balance),
        hostelName: ten?.name ?? 'Your Property',
        tenantId: params.tenantId,
      }).catch(() => {})
    }

    if (admins.emailEnabled && occ?.email && ten) {
      sendEmail({
        to: occ.email,
        senderName: ten.name,
        subject: `Payment receipt — ${ten.name}`,
        html: paymentReceiptHtml({
          hostelName: ten.name,
          primaryColor: ten.primary_color ?? '#2563EB',
          logoUrl: (ten as any).logo_url ?? null,
          guestName,
          bookingRef,
          amountGHS,
          method: 'Online',
          paidAt: new Date().toLocaleDateString('en-GH', { dateStyle: 'long' }),
          balance: formatGHS(balance),
        }),
      }).catch(() => {})
    }

    const eventLine = params.requiresResolution
      ? `ACTION REQUIRED: ${amountGHS} received after cancelled booking ${bookingRef}. Review refund or restoration.`
      : `Payment of ${amountGHS} received online from ${guestName} (${bookingRef})`

    if (admins.smsEnabled) {
      for (const phone of admins.phones) {
        sendAdminBookingAlert({
          phone,
          hostelName: ten?.name ?? 'Your Property',
          eventLine,
          tenantId: params.tenantId,
        }).catch(() => {})
      }
    }

    if (admins.emailEnabled && ten) {
      for (const email of admins.emails) {
        sendEmail({
          to: email,
          senderName: ten.name,
          subject: `${params.requiresResolution ? 'Payment needs resolution' : 'Payment received'} — ${bookingRef}`,
          html: adminAlertHtml({
            hostelName: ten.name,
            primaryColor: ten.primary_color ?? '#2563EB',
            logoUrl: (ten as any).logo_url ?? null,
            title: params.requiresResolution
              ? 'Late payment needs resolution'
              : 'Payment received online',
            lines: [
              { label: 'Guest', value: guestName },
              { label: 'Amount', value: amountGHS },
              { label: 'Booking', value: bookingRef },
              { label: 'Balance', value: formatGHS(balance) },
            ],
          }),
        }).catch(() => {})
      }
    }
  } catch {
    // Non-critical — never let notification failure affect the payment flow.
  }
}
