/**
 * Arkesel SMS service — server-side only.
 * Gracefully no-ops when ARKESEL_API_KEY is not set.
 */

const ARKESEL_BASE = 'https://sms.arkesel.com/api/v2/sms/send'

function isEnabled() {
  return !!process.env.ARKESEL_API_KEY
}

function formatPhone(phone: string): string {
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
      sender:     process.env.ARKESEL_SENDER_ID || 'AbrempHMS',
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

/* ── Typed message templates ─────────────────────────────────────── */

export async function sendBookingConfirmation(params: {
  phone: string
  firstName: string
  bookingRef: string
  roomNumber: string
  checkInDate: string
  hostelName: string
}) {
  const msg = `Hi ${params.firstName}, your booking at ${params.hostelName} is confirmed!\n` +
    `Ref: ${params.bookingRef}\nRoom: ${params.roomNumber}\nCheck-in: ${params.checkInDate}\n` +
    `Keep this message as your reference.`
  await send(params.phone, msg)
}

export async function sendPaymentReceipt(params: {
  phone: string
  firstName: string
  amountGHS: string
  method: string
  bookingRef: string
  balance: string
  hostelName: string
}) {
  const balanceNote = params.balance !== 'GH₵0.00'
    ? `\nOutstanding balance: ${params.balance}.`
    : '\nYour account is fully paid. Thank you!'

  const msg = `Payment received — ${params.hostelName}\n` +
    `Hi ${params.firstName}, we received ${params.amountGHS} via ${params.method}.\n` +
    `Booking: ${params.bookingRef}${balanceNote}`
  await send(params.phone, msg)
}

export async function sendOverdueReminder(params: {
  phone: string
  firstName: string
  balance: string
  daysOverdue: number
  bookingRef: string
  hostelName: string
}) {
  const msg = `Rent reminder — ${params.hostelName}\n` +
    `Hi ${params.firstName}, your payment of ${params.balance} is ${params.daysOverdue} day(s) overdue.\n` +
    `Ref: ${params.bookingRef}. Please pay promptly to avoid losing your room.`
  await send(params.phone, msg)
}

export async function sendCheckInReminder(params: {
  phone: string
  firstName: string
  checkInDate: string
  roomNumber: string
  hostelName: string
}) {
  const msg = `Check-in reminder — ${params.hostelName}\n` +
    `Hi ${params.firstName}, your check-in is tomorrow (${params.checkInDate}).\n` +
    `Room: ${params.roomNumber}. See you then!`
  await send(params.phone, msg)
}
