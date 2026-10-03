import type { SupabaseClient } from '@supabase/supabase-js'

import { sendEmail, adminAlertHtml, bookingCancelledHtml } from '@/lib/email'
import { sendAdminBookingAlert, sendBookingCancelled } from '@/lib/sms'
import { getTenantAdminContacts } from '@/lib/notifications/admin-recipients'
import { fireWebhook } from '@/lib/webhooks'
import { formatGHS } from '@/lib/utils'

export const CANCELLATION_SOURCES = [
  'staff',
  'bulk',
  'group',
  'payment_expired',
  'self_checkin_expired',
  'self_checkin_rejected',
  'ai_assistant',
  'guest',
] as const

export type CancellationSource = (typeof CANCELLATION_SOURCES)[number]

export interface CancelBookingInput {
  tenantId: string
  bookingId: string
  reason: string
  source: CancellationSource
  actorId?: string | null
  expectedStatus?: string | null
}

export interface CancelBookingResult {
  changed: boolean
  id: string
  booking_ref?: string
  previous_status: string
  status: 'cancelled'
  cancelled_at?: string
  cancellation_reason?: string
  cancellation_source?: string
}

/**
 * Canonical application entry point for cancelling a booking.
 *
 * The RPC owns the row lock, transition validation and database side effects.
 * Notifications deliberately happen after commit and are best-effort: an SMS
 * provider outage must never roll back a valid cancellation. The RPC is
 * idempotent, so retries do not send duplicate notifications.
 */
export async function cancelBooking(
  supabase: SupabaseClient<any>,
  input: CancelBookingInput
): Promise<CancelBookingResult> {
  const reason = input.reason.trim()
  if (!reason) throw new Error('A cancellation reason is required')

  const { data, error } = await supabase.rpc('cancel_booking', {
    p_tenant_id: input.tenantId,
    p_booking_id: input.bookingId,
    p_reason: reason,
    p_source: input.source,
    p_actor_id: input.actorId ?? null,
    p_expected_status: input.expectedStatus ?? null,
  })

  if (error) throw new Error(error.message)

  const result = data as CancelBookingResult | null
  if (!result) throw new Error('Cancellation returned no result')

  if (result.changed) {
    await notifyBookingCancelled(supabase, input.tenantId, input.bookingId, reason, input.source)
  }

  return result
}

async function notifyBookingCancelled(
  supabase: SupabaseClient<any>,
  tenantId: string,
  bookingId: string,
  reason: string,
  source: CancellationSource
): Promise<void> {
  try {
    const [{ data: bookingRaw }, admins] = await Promise.all([
      supabase
        .from('bookings')
        .select(
          `
          id, booking_ref, payment_status, paid_amount, final_amount,
          occupant:occupants(first_name, last_name, phone, email),
          room:rooms(room_number, category:room_categories(name)),
          tenant:tenants(name, primary_color, logo_url)
        `
        )
        .eq('id', bookingId)
        .eq('tenant_id', tenantId)
        .single(),
      getTenantAdminContacts(supabase, tenantId),
    ])

    if (!bookingRaw) return

    const booking = bookingRaw as any
    const occupant = Array.isArray(booking.occupant) ? booking.occupant[0] : booking.occupant
    const room = Array.isArray(booking.room) ? booking.room[0] : booking.room
    const category = room ? (Array.isArray(room.category) ? room.category[0] : room.category) : null
    const tenant = Array.isArray(booking.tenant) ? booking.tenant[0] : booking.tenant
    if (!tenant) return

    const guestName = occupant ? `${occupant.first_name} ${occupant.last_name}`.trim() : 'Guest'
    const roomLabel = room?.room_number ?? category?.name ?? 'Unassigned'
    const amountPaid = formatGHS(booking.paid_amount ?? 0)
    const hasPayment = booking.payment_status === 'paid' || (booking.paid_amount ?? 0) > 0
    const eventLine = `Booking cancelled: ${guestName} — ${roomLabel} (${booking.booking_ref}). Reason: ${reason}`
    const tasks: Promise<unknown>[] = []

    if (occupant?.email) {
      tasks.push(
        sendEmail({
          to: occupant.email,
          senderName: tenant.name,
          subject: `Booking cancelled — ${booking.booking_ref}`,
          html: bookingCancelledHtml({
            hostelName: tenant.name,
            primaryColor: tenant.primary_color ?? '#2563EB',
            logoUrl: tenant.logo_url,
            guestName,
            bookingRef: booking.booking_ref,
            reason,
            hasPayment,
          }),
        })
      )
    }

    if (occupant?.phone) {
      tasks.push(
        sendBookingCancelled({
          phone: occupant.phone,
          firstName: occupant.first_name,
          bookingRef: booking.booking_ref,
          hostelName: tenant.name,
          reason,
          hasPayment,
          tenantId,
        })
      )
    }

    if (admins.smsEnabled) {
      for (const phone of admins.phones) {
        tasks.push(sendAdminBookingAlert({ phone, hostelName: tenant.name, eventLine, tenantId }))
      }
    }

    if (admins.emailEnabled) {
      for (const email of admins.emails) {
        tasks.push(
          sendEmail({
            to: email,
            senderName: tenant.name,
            subject: `Booking cancelled — ${booking.booking_ref}`,
            html: adminAlertHtml({
              hostelName: tenant.name,
              primaryColor: tenant.primary_color ?? '#2563EB',
              logoUrl: tenant.logo_url,
              title: 'Booking cancelled',
              lines: [
                { label: 'Guest', value: guestName },
                { label: 'Room', value: roomLabel },
                { label: 'Booking', value: booking.booking_ref },
                { label: 'Reason', value: reason },
                { label: 'Source', value: source.replaceAll('_', ' ') },
                { label: 'Paid', value: amountPaid },
              ],
            }),
          })
        )
      }
    }

    tasks.push(
      fireWebhook(tenantId, 'booking.cancelled', {
        booking_id: bookingId,
        booking_ref: booking.booking_ref,
        reason,
        source,
        payment_status: booking.payment_status,
        paid_amount: booking.paid_amount,
      })
    )

    await Promise.allSettled(tasks)
  } catch (error) {
    console.error('[booking cancellation notification]', error)
  }
}
