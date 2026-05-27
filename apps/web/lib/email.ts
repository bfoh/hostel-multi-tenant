/**
 * Transactional email via Resend.
 * Gracefully no-ops when RESEND_API_KEY is absent (local dev without email).
 */

const RESEND_API = 'https://api.resend.com/emails'

interface SendParams {
  to:         string | string[]
  subject:    string
  html:       string
  replyTo?:   string
  senderName?: string
}

/**
 * Returns `{ ok: true }` on accept, `{ ok: false, error }` on any failure
 * (missing key, network error, Resend rejection). Errors are also logged
 * to console so they show up in the Vercel function log.
 *
 * Most callers can fire-and-forget by ignoring the result, but invite /
 * credential routes should check `ok` so they don't lie to the dashboard
 * about delivery.
 */
export async function sendEmail(params: SendParams): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY missing — email skipped:', params.subject)
    return { ok: false, error: 'RESEND_API_KEY missing' }
  }

  const address = process.env.RESEND_FROM_EMAIL ?? 'no-reply@updates.gh-hostels.com'
  // Display name is the tenant/hostel — recipients see the hostel, not the
  // platform. The sending domain stays the verified gh-hostels domain.
  const from = params.senderName
    ? `${params.senderName} <${address}>`
    : `Hostel Notifications <${address}>`

  try {
    const res = await fetch(RESEND_API, {
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
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('[email] Resend rejected:', res.status, text)
      return { ok: false, error: `Resend ${res.status}: ${text || 'unknown error'}` }
    }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[email] network error:', msg)
    return { ok: false, error: msg }
  }
}

/* ── Email templates ────────────────────────────────────────────────────── */

export function baseTemplate(
  hostelName: string,
  primaryColor: string,
  content: string,
  logoUrl?: string | null,
) {
  // When a logo is present, show it in a white rounded chip beside the
  // hostel name; otherwise fall back to the name alone.
  const headerInner = logoUrl
    ? `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
         <tr>
           <td width="46" valign="middle" style="background:#ffffff;border-radius:8px;padding:3px;">
             <img src="${logoUrl}" alt="${hostelName}" width="40" height="40"
                  style="display:block;width:40px;height:40px;border-radius:6px;object-fit:contain;" />
           </td>
           <td valign="middle" style="padding-left:12px;">
             <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">${hostelName}</p>
           </td>
         </tr>
       </table>`
    : `<p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">${hostelName}</p>`

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
            <td style="background:${primaryColor};padding:20px 32px;">
              ${headerInner}
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
                ${hostelName}
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
  logoUrl?:      string | null
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
    hostelName, primaryColor, logoUrl, guestName, bookingRef,
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

  return baseTemplate(hostelName, primaryColor, content, logoUrl)
}

/* ── Payment receipt email ──────────────────────────────────────────────── */

export function paymentReceiptHtml(opts: {
  hostelName:   string
  primaryColor: string
  logoUrl?:     string | null
  guestName:    string
  bookingRef:   string
  amountGHS:    string
  method:       string
  paidAt:       string
  balance:      string
}) {
  const { hostelName, primaryColor, logoUrl, guestName, bookingRef, amountGHS, method, paidAt, balance } = opts

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

  return baseTemplate(hostelName, primaryColor, content, logoUrl)
}

/* ── Invoice pay link email ─────────────────────────────────────────────── */

export function invoicePayLinkHtml(opts: {
  hostelName:    string
  primaryColor:  string
  logoUrl?:      string | null
  guestName:     string
  invoiceNumber: string
  amountGHS:     string
  url:           string
}) {
  const { hostelName, primaryColor, logoUrl, guestName, invoiceNumber, amountGHS, url } = opts

  const content = `
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Pay your invoice</p>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">
      Hi ${guestName}, here is the secure payment link for invoice <strong>${invoiceNumber}</strong> at ${hostelName}.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      ${row('Invoice', invoiceNumber)}
      ${row('Amount due', amountGHS)}
      ${row('Methods', 'Mobile Money · Card · Bank Transfer')}
    </table>
    ${button(url, `Pay ${amountGHS}`, primaryColor)}
    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">
      Or copy this link into your browser:<br/>
      <span style="word-break:break-all;color:#374151;">${url}</span>
    </p>
  `

  return baseTemplate(hostelName, primaryColor, content, logoUrl)
}

/* ── Portal credentials email ───────────────────────────────────────────── */

export function portalCredentialsHtml(opts: {
  hostelName:        string
  primaryColor:      string
  logoUrl?:          string | null
  firstName:         string
  email:             string
  password:          string
  loginUrl:          string
  changePasswordUrl: string
}) {
  const { hostelName, primaryColor, logoUrl, firstName, email, password, loginUrl, changePasswordUrl } = opts

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
        <strong>Important:</strong> You must set your own personal password before you can access the resident portal. Click the button below to log in and choose your new password.
      </p>
    </div>
    ${button(loginUrl, 'Sign in and set password', primaryColor)}
  `

  return baseTemplate(hostelName, primaryColor, content, logoUrl)
}

/* ── Staff credentials email ────────────────────────────────────────────── */

export function staffCredentialsHtml(opts: {
  hostelName:        string
  primaryColor:      string
  logoUrl?:          string | null
  firstName:         string
  email:             string
  password:          string
  loginUrl:          string
  changePasswordUrl: string
}) {
  const { hostelName, primaryColor, logoUrl, firstName, email, password, loginUrl } = opts

  const content = `
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Your Staff Portal Access</p>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">
      Hi ${firstName}, your staff account has been set up for <strong>${hostelName}</strong>.
      Use the temporary credentials below to sign in.
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:24px;">
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
        ${row('Email', email)}
        ${row('Password', `<span style="font-family:monospace;font-size:15px;font-weight:700;color:#111827;letter-spacing:0.05em;">${password}</span>`)}
      </table>
    </div>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#92400e;">
        <strong>Important:</strong> You must set your own personal password before you can access the staff portal. Click the button below to log in and choose your new password.
      </p>
    </div>
    ${button(loginUrl, 'Sign in and set password', primaryColor)}
  `

  return baseTemplate(hostelName, primaryColor, content, logoUrl)
}

/* ── Magic-link invite email ────────────────────────────────────────────── */

export function inviteHtml(opts: {
  hostelName:     string
  primaryColor:   string
  logoUrl?:       string | null
  firstName:      string
  portalLabel:    string  // e.g. "staff dashboard" / "resident portal"
  verifyUrl:      string  // /auth/verify-otp?email=...
  otpCode?:       string  // 6-digit code from supabase generateLink
}) {
  const { hostelName, primaryColor, logoUrl, firstName, portalLabel, verifyUrl, otpCode } = opts

  // Prefer the OTP code over a clickable link because Gmail/Outlook safe-link
  // scanners pre-fetch URLs and burn single-use Supabase magic links before
  // the user can click. Codes are scanner-safe — bots don't type them.
  const codeBlock = otpCode
    ? `
      <div style="margin:24px 0;border:1px solid #e5e7eb;border-radius:12px;padding:20px 16px;background:#f9fafb;text-align:center;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.08em;color:#6b7280;text-transform:uppercase;">Your code</p>
        <p style="margin:0;font-family:'Menlo',Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#111827;">${otpCode}</p>
      </div>
    `
    : ''

  const content = `
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">You're invited</p>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">
      Hi ${firstName}, you've been invited to access the <strong>${hostelName}</strong> ${portalLabel}.
      Use the button below to enter your code and finish setup.
    </p>
    ${button(verifyUrl, 'Accept invitation', primaryColor)}
    ${codeBlock}
    <p style="margin:0;font-size:12px;color:#9ca3af;">
      The code is valid for 1 hour. If you didn't expect this invitation, ignore this email.
    </p>
    <p style="margin:8px 0 0;font-size:11px;color:#9ca3af;word-break:break-all;">
      Or paste this URL into your browser: ${verifyUrl}
    </p>
  `

  return baseTemplate(hostelName, primaryColor, content, logoUrl)
}

/* ── Check-out summary email ────────────────────────────────────────────── */

export function checkoutSummaryHtml(opts: {
  hostelName:   string
  primaryColor: string
  logoUrl?:     string | null
  guestName:    string
  bookingRef:   string
  roomName:     string
  checkOutDate: string
  totalPaid:    string
}) {
  const { hostelName, primaryColor, logoUrl, guestName, bookingRef, roomName, checkOutDate, totalPaid } = opts

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

  return baseTemplate(hostelName, primaryColor, content, logoUrl)
}

/* ── Trial warning email (T-3, T-1) ─────────────────────────────────────── */

export function trialWarningHtml(opts: {
  hostelName:    string
  primaryColor:  string
  logoUrl?:      string | null
  ownerName?:    string | null
  daysLeft:      number
  trialEndsAt:   string
  billingUrl:    string
}) {
  const { hostelName, primaryColor, logoUrl, ownerName, daysLeft, trialEndsAt, billingUrl } = opts
  const dayWord = daysLeft === 1 ? 'day' : 'days'

  const content = `
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">
      Your trial ends in ${daysLeft} ${dayWord}
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">
      Hi${ownerName ? ` ${ownerName}` : ''}, your <strong>${hostelName}</strong> free trial on GH Hostels expires on
      <strong>${trialEndsAt}</strong>. Pick a plan now to keep bookings, payments, and reports running without interruption.
    </p>
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#92400e;">
        After the trial ends, the dashboard pauses for new bookings and payment links stop generating. Your data is kept safe — pick a plan any time to resume.
      </p>
    </div>
    ${button(billingUrl, 'Choose a plan', primaryColor)}
    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">
      Questions? Reply to this email and we will get back the same day.
    </p>
  `

  return baseTemplate(hostelName, primaryColor, content, logoUrl)
}

/* ── Trial-expired email (T+0) ──────────────────────────────────────────── */

export function trialExpiredHtml(opts: {
  hostelName:    string
  primaryColor:  string
  logoUrl?:      string | null
  ownerName?:    string | null
  billingUrl:    string
}) {
  const { hostelName, primaryColor, logoUrl, ownerName, billingUrl } = opts

  const content = `
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Your trial has ended</p>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">
      Hi${ownerName ? ` ${ownerName}` : ''}, your <strong>${hostelName}</strong> trial on GH Hostels ended today. Your account is paused until you pick a plan.
    </p>
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#92400e;">
        All your rooms, occupants, and history are preserved. You will not lose anything — sign up for a plan and pick up where you left off.
      </p>
    </div>
    ${button(billingUrl, 'Reactivate now', primaryColor)}
    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">
      Need help choosing a plan or want a demo? Just reply to this email.
    </p>
  `

  return baseTemplate(hostelName, primaryColor, content, logoUrl)
}

/* ── Internal ops: new-tenant lead notification ─────────────────────────── */

export function newTenantLeadHtml(opts: {
  hostelName:    string
  ownerEmail:    string
  ownerName?:    string | null
  slug:          string
  customDomain?: string | null
  contactPhone?: string | null
  contactEmail?: string | null
  city?:         string | null
  region?:       string | null
  tagline?:      string | null
  selectedPlan?: string | null
  signupAt:      string
  dashboardUrl?: string
}) {
  const {
    hostelName, ownerEmail, ownerName, slug, customDomain, contactPhone,
    contactEmail, city, region, tagline, selectedPlan, signupAt, dashboardUrl,
  } = opts

  const location = [city, region].filter(Boolean).join(', ') || '—'
  const planLabel = selectedPlan ? selectedPlan[0].toUpperCase() + selectedPlan.slice(1) : 'Not selected'

  const content = `
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">New hostel signup</p>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">
      A new tenant just finished the first step of onboarding. Reach out within 30 minutes for the best activation rate.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      ${row('Hostel', hostelName)}
      ${row('Owner', ownerName ?? '—')}
      ${row('Login email', ownerEmail)}
      ${row('Subdomain', slug)}
      ${customDomain ? row('Custom domain', customDomain) : ''}
      ${row('Phone', contactPhone ?? '—')}
      ${row('Hostel contact email', contactEmail ?? '—')}
      ${row('Location', location)}
      ${row('Tagline', tagline ?? '—')}
      ${row('Plan picked', planLabel)}
      ${row('Signed up', signupAt)}
    </table>
    ${dashboardUrl
      ? `<p style="margin:0;font-size:13px;color:#374151;">Open in admin: <a href="${dashboardUrl}" style="color:#1B4F72;">${dashboardUrl}</a></p>`
      : ''}
  `

  return baseTemplate('GH Hostels — Ops', '#0A3729', content, null)
}

/* ── Password reset email ───────────────────────────────────────────────── */

export function passwordResetHtml(opts: {
  hostelName:   string
  primaryColor: string
  logoUrl?:     string | null
  resetCode:    string
  resetUrl:     string
}) {
  const { hostelName, primaryColor, logoUrl, resetCode, resetUrl } = opts

  const content = `
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Reset your password</p>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">
      We received a request to reset the password for your <strong>${hostelName}</strong>
      account. Enter the code below on the reset page to choose a new password.
    </p>
    <div style="margin:24px 0;border:1px solid #e5e7eb;border-radius:12px;padding:20px 16px;background:#f9fafb;text-align:center;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.08em;color:#6b7280;text-transform:uppercase;">Your reset code</p>
      <p style="margin:0;font-family:'Menlo',Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#111827;">${resetCode}</p>
    </div>
    ${button(resetUrl, "Open reset page", primaryColor)}
    <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">
      This code is valid for 1 hour. If you did not request a password reset,
      ignore this email \u2014 your password stays unchanged.
    </p>
  `

  return baseTemplate(hostelName, primaryColor, content, logoUrl)
}
