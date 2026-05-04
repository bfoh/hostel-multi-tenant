/**
 * Arkesel SMS service — server-side only.
 * Gracefully no-ops when ARKESEL_API_KEY is not set.
 *
 * When `tenantId` is passed, message bodies are pulled from the
 * `notification_templates` table (with baked-in fallback) via render.ts.
 */

import { renderNotification, renderTemplate } from '@/lib/notifications/render'
import type { EventType } from '@/lib/notifications/defaults'

const ARKESEL_BASE = 'https://sms.arkesel.com/api/v2/sms/send'

function isEnabled() {
  return !!process.env.ARKESEL_API_KEY
}

export function formatPhone(phone: string): string {
  // Normalise to international format for Ghana: 0244... → 233244...
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length === 10) return `233${digits.slice(1)}`
  if (digits.startsWith('233')) return digits
  return digits
}

async function send(to: string | string[], message: string): Promise<void> {
  if (!isEnabled()) {
    console.info('[SMS] ARKESEL_API_KEY not set — skipping SMS to', to)
    return
  }

  const recipients = (Array.isArray(to) ? to : [to]).map(formatPhone)

  const res = await fetch(ARKESEL_BASE, {
    method: 'POST',
    headers: {
      'api-key':     process.env.ARKESEL_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender:     process.env.ARKESEL_SENDER_ID || 'GH Hostels',
      message,
      recipients,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error('[SMS] Arkesel error:', res.status, text)
    // Don't throw — SMS failure should never block the main operation
  }
}

/**
 * Resolve the SMS body for an event. Uses the tenant template when `tenantId`
 * is provided; otherwise renders the hardcoded fallback directly.
 */
async function resolveSmsBody(
  event: EventType,
  fallback: string,
  vars: Record<string, string | number>,
  tenantId?: string,
): Promise<string> {
  if (tenantId) {
    const rendered = await renderNotification(tenantId, event, 'sms', vars)
    if (rendered) return rendered.body
  }
  return renderTemplate(fallback, vars)
}

/* ── Typed message templates ─────────────────────────────────────── */

export async function sendBookingConfirmation(params: {
  phone:        string
  firstName:    string
  bookingRef:   string
  roomNumber:   string
  checkInDate:  string
  hostelName:   string
  tenantId?:    string
  amount?:      string
}) {
  const fallback =
    'Hi {{first_name}}, your booking at {{hostel_name}} is confirmed! ' +
    'Ref: {{booking_ref}} Room: {{room_number}} Check-in: {{check_in_date}}. ' +
    'Keep this message as reference.'

  const msg = await resolveSmsBody('booking_confirmed', fallback, {
    first_name:     params.firstName,
    booking_ref:    params.bookingRef,
    room_number:    params.roomNumber,
    check_in_date:  params.checkInDate,
    hostel_name:    params.hostelName,
    amount:         params.amount ?? '',
  }, params.tenantId)

  await send(params.phone, msg)
}

export async function sendPaymentReceipt(params: {
  phone:      string
  firstName:  string
  amountGHS:  string
  method:     string
  bookingRef: string
  balance:    string
  hostelName: string
  tenantId?:  string
}) {
  const fallback =
    'Payment received — {{hostel_name}}. Hi {{first_name}}, we received {{amount}} ' +
    'via {{method}} for booking {{booking_ref}}. Balance: {{balance}}.'

  const msg = await resolveSmsBody('payment_received', fallback, {
    first_name:  params.firstName,
    amount:      params.amountGHS,
    method:      params.method,
    booking_ref: params.bookingRef,
    balance:     params.balance,
    hostel_name: params.hostelName,
  }, params.tenantId)

  await send(params.phone, msg)
}

export async function sendOverdueReminder(params: {
  phone:       string
  firstName:   string
  balance:     string
  daysOverdue: number
  bookingRef:  string
  hostelName:  string
  tenantId?:   string
}) {
  const fallback =
    'Rent reminder — {{hostel_name}}. Hi {{first_name}}, your payment of {{amount}} ' +
    'is {{days_remaining}} day(s) overdue. Ref: {{booking_ref}}. Please pay promptly.'

  const msg = await resolveSmsBody('payment_reminder', fallback, {
    first_name:     params.firstName,
    amount:         params.balance,
    days_remaining: params.daysOverdue,
    booking_ref:    params.bookingRef,
    hostel_name:    params.hostelName,
    due_date:       '',
  }, params.tenantId)

  await send(params.phone, msg)
}

export async function sendCheckInReminder(params: {
  phone:       string
  firstName:   string
  checkInDate: string
  roomNumber:  string
  hostelName:  string
  tenantId?:   string
}) {
  const fallback =
    'Check-in reminder — {{hostel_name}}. Hi {{first_name}}, your check-in is on ' +
    '{{check_in_date}}. Room: {{room_number}}. See you then!'

  const msg = await resolveSmsBody('checkin_reminder', fallback, {
    first_name:    params.firstName,
    check_in_date: params.checkInDate,
    room_number:   params.roomNumber,
    hostel_name:   params.hostelName,
  }, params.tenantId)

  await send(params.phone, msg)
}

export async function sendCheckoutReminder(params: {
  phone:        string
  firstName:    string
  checkOutDate: string
  bookingRef:   string
  hostelName:   string
  tenantId?:    string
}) {
  const fallback =
    'Hi {{first_name}}, your stay at {{hostel_name}} ends on {{check_out_date}} ' +
    '(Ref: {{booking_ref}}). Contact us to renew or arrange checkout.'

  const msg = await resolveSmsBody('checkout_reminder', fallback, {
    first_name:     params.firstName,
    check_out_date: params.checkOutDate,
    booking_ref:    params.bookingRef,
    hostel_name:    params.hostelName,
  }, params.tenantId)

  await send(params.phone, msg)
}

export async function sendLeaseExpiryReminder(params: {
  phone:         string
  firstName:     string
  checkOutDate:  string
  daysRemaining: number
  bookingRef:    string
  hostelName:    string
  tenantId?:     string
}) {
  const fallback =
    'Hi {{first_name}}, your lease at {{hostel_name}} expires in {{days_remaining}} days ' +
    '({{check_out_date}}). Ref: {{booking_ref}}. Contact us to renew.'

  const msg = await resolveSmsBody('lease_expiry_reminder', fallback, {
    first_name:     params.firstName,
    check_out_date: params.checkOutDate,
    days_remaining: params.daysRemaining,
    booking_ref:    params.bookingRef,
    hostel_name:    params.hostelName,
  }, params.tenantId)

  await send(params.phone, msg)
}

export async function sendBookingCancelled(params: {
  phone:      string
  firstName:  string
  bookingRef: string
  hostelName: string
  tenantId?:  string
}) {
  const fallback =
    'Hi {{first_name}}, your booking {{booking_ref}} at {{hostel_name}} has been cancelled. ' +
    'Please contact us for refund details.'

  const msg = await resolveSmsBody('booking_cancelled', fallback, {
    first_name:  params.firstName,
    booking_ref: params.bookingRef,
    hostel_name: params.hostelName,
  }, params.tenantId)

  await send(params.phone, msg)
}

export async function sendDepositRefund(params: {
  phone:         string
  firstName:     string
  refundAmount:  string
  bookingRef:    string
  hostelName:    string
  tenantId?:     string
}) {
  const fallback =
    'Hi {{first_name}}, your deposit refund of {{refund_amount}} for booking ' +
    '{{booking_ref}} at {{hostel_name}} has been processed.'

  const msg = await resolveSmsBody('deposit_refund', fallback, {
    first_name:     params.firstName,
    refund_amount:  params.refundAmount,
    booking_ref:    params.bookingRef,
    hostel_name:    params.hostelName,
  }, params.tenantId)

  await send(params.phone, msg)
}

// Back-compat alias for existing callers
export { sendOverdueReminder as sendPaymentReminder }

export async function sendPortalCredentials(params: {
  phone: string
  firstName: string
  email: string
  password: string
  loginUrl: string
  changePasswordUrl: string
  hostelName: string
}) {
  const msg = `${params.hostelName} — Resident Portal Access\n` +
    `Hi ${params.firstName}!\n` +
    `Your portal account has been created.\n\n` +
    `Login: ${params.loginUrl}\n` +
    `Email: ${params.email}\n` +
    `Password: ${params.password}\n\n` +
    `IMPORTANT: Change your password after logging in:\n` +
    `${params.changePasswordUrl}`
  await send(params.phone, msg)
}
