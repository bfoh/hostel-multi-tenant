/**
 * Transactional email via Resend.
 * Gracefully no-ops when RESEND_API_KEY is absent (local dev without email).
 */

const RESEND_API = 'https://api.resend.com/emails'

interface SendParams {
  to:      string | string[]
  subject: string
  html:    string
  replyTo?: string
}

export async function sendEmail(params: SendParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return  // silently skip when not configured

  const from = process.env.RESEND_FROM_EMAIL ?? 'no-reply@ghh.com'

  await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to:      Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html:    params.html,
      reply_to: params.replyTo,
    }),
  }).catch(() => {}) // fire-and-forget — never block the main flow
}

/* ── Email templates ────────────────────────────────────────────────────── */

export function baseTemplate(hostelName: string, primaryColor: string, content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${hostelName}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
          <!-- Header bar -->
          <tr>
            <td style="background:${primaryColor};padding:24px 32px;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">${hostelName}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Powered by <strong>GH Hostels</strong> · ${hostelName}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function row(label: string, value: string) {
  return `<tr>
    <td style="padding:6px 0;font-size:14px;color:#6b7280;width:140px;">${label}</td>
    <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:500;">${value}</td>
  </tr>`
}

export function button(href: string, text: string, color: string) {
  return `<a href="${href}"
    style="display:inline-block;margin-top:20px;padding:12px 28px;background:${color};color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
    ${text}
  </a>`
}

/* ── Booking confirmation email ─────────────────────────────────────────── */

export function bookingConfirmationHtml(opts: {
  hostelName:    string
  primaryColor:  string
  guestName:     string
  bookingRef:    string
  roomName:      string
  checkInDate:   string
  checkOutDate:  string
  amountGHS:     string
  contactPhone?: string
  portalUrl?:    string
}) {
  const {
    hostelName, primaryColor, guestName, bookingRef,
    roomName, checkInDate, checkOutDate, amountGHS, contactPhone, portalUrl,
  } = opts

  const content = `
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Booking Confirmed</p>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">
      Hi ${guestName}, your booking at <strong>${hostelName}</strong> has been received. Here are your details:
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${row('Booking ref', bookingRef)}
      ${row('Room', roomName)}
      ${row('Check-in', checkInDate)}
      ${row('Check-out', checkOutDate)}
      ${row('Amount due', amountGHS)}
    </table>
    <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#374151;">
        <strong>Next step:</strong> Payment is due at check-in${contactPhone ? ` or call <a href="tel:${contactPhone}" style="color:${primaryColor};">${contactPhone}</a> to arrange MoMo payment.` : '.'}
      </p>
    </div>
    <p style="font-size:13px;color:#6b7280;margin:0;">
      Keep your booking reference <strong style="color:#111827;">${bookingRef}</strong> — you'll need it at check-in.
    </p>
    ${portalUrl ? button(portalUrl, 'View my booking', primaryColor) : ''}
  `

  return baseTemplate(hostelName, primaryColor, content)
}

/* ── Payment receipt email ──────────────────────────────────────────────── */

export function paymentReceiptHtml(opts: {
  hostelName:   string
  primaryColor: string
  guestName:    string
  bookingRef:   string
  amountGHS:    string
  method:       string
  paidAt:       string
  balance:      string
}) {
  const { hostelName, primaryColor, guestName, bookingRef, amountGHS, method, paidAt, balance } = opts

  const content = `
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Payment Received</p>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">
      Hi ${guestName}, we've received your payment. Thank you!
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${row('Booking ref', bookingRef)}
      ${row('Amount paid', amountGHS)}
      ${row('Method', method)}
      ${row('Date', paidAt)}
      ${row('Balance due', balance)}
    </table>
    ${parseFloat(balance.replace(/[^0-9.]/g, '')) > 0
      ? `<div style="background:#fef3c7;border-radius:8px;padding:14px 16px;">
           <p style="margin:0;font-size:13px;color:#92400e;">Remaining balance of <strong>${balance}</strong> is due at check-in.</p>
         </div>`
      : `<div style="background:#d1fae5;border-radius:8px;padding:14px 16px;">
           <p style="margin:0;font-size:13px;color:#065f46;">Your account is <strong>fully paid</strong>. We look forward to hosting you!</p>
         </div>`
    }
  `

  return baseTemplate(hostelName, primaryColor, content)
}

/* ── Portal credentials email ───────────────────────────────────────────── */

export function portalCredentialsHtml(opts: {
  hostelName:        string
  primaryColor:      string
  firstName:         string
  email:             string
  password:          string
  loginUrl:          string
  changePasswordUrl: string
}) {
  const { hostelName, primaryColor, firstName, email, password, loginUrl, changePasswordUrl } = opts

  const content = `
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Your Resident Portal Access</p>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">
      Hi ${firstName}, your account has been set up on the <strong>${hostelName}</strong> resident portal.
      Use the credentials below to sign in.
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:24px;">
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
        ${row('Login page', `<a href="${loginUrl}" style="color:${primaryColor};">${loginUrl}</a>`)}
        ${row('Email', email)}
        ${row('Password', `<span style="font-family:monospace;font-size:15px;font-weight:700;color:#111827;letter-spacing:0.05em;">${password}</span>`)}
      </table>
    </div>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#92400e;">
        <strong>Important:</strong> This is a temporary password. Please change it immediately after your first login.
      </p>
    </div>
    ${button(loginUrl, 'Sign in to your portal', primaryColor)}
    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">
      After signing in, go to <a href="${changePasswordUrl}" style="color:${primaryColor};">Settings → Change password</a> to set a personal password.
    </p>
  `

  return baseTemplate(hostelName, primaryColor, content)
}

/* ── Check-out summary email ────────────────────────────────────────────── */

export function checkoutSummaryHtml(opts: {
  hostelName:   string
  primaryColor: string
  guestName:    string
  bookingRef:   string
  roomName:     string
  checkOutDate: string
  totalPaid:    string
}) {
  const { hostelName, primaryColor, guestName, bookingRef, roomName, checkOutDate, totalPaid } = opts

  const content = `
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Thanks for staying with us!</p>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">
      Hi ${guestName}, we hope you enjoyed your stay at <strong>${hostelName}</strong>. Here's your check-out summary:
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${row('Booking ref', bookingRef)}
      ${row('Room', roomName)}
      ${row('Checked out', checkOutDate)}
      ${row('Total paid', totalPaid)}
    </table>
    <p style="font-size:14px;color:#374151;margin:0;">
      We'd love to have you back! Visit our booking page to reserve your next stay.
    </p>
  `

  return baseTemplate(hostelName, primaryColor, content)
}
