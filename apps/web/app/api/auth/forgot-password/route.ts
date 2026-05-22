import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveTenant } from '@/lib/tenant/resolve'
import { sendEmail, passwordResetHtml } from '@/lib/email'

/**
 * POST /api/auth/forgot-password   body: { email, host? }
 *
 * Sends a tenant-branded password-reset email via Resend instead of relying
 * on Supabase's built-in (unbranded, SMTP-dependent) reset mail.
 *
 * We use admin.generateLink({ type: 'magiclink' }) which mints a login
 * token WITHOUT dispatching Supabase's own email, and returns a 6-digit
 * email_otp. The user enters that code on /reset-password, which calls
 * verifyOtp({ type: 'magiclink' }) to get a session, then updateUser.
 * magiclink (not recovery) is used because that exact generateLink +
 * verifyOtp pairing is already proven by the invite flow — the recovery
 * pairing intermittently returns "Token has expired or is invalid".
 *
 * Always responds 200 — never reveal whether an account exists.
 */
export async function POST(req: NextRequest) {
  let body: { email?: string; host?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: true }) }

  const email = body.email?.trim().toLowerCase()
  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    // Bad input — still don't leak. Pretend success.
    return NextResponse.json({ ok: true })
  }

  // Resolve tenant for branding from the host the user is on.
  const host = body.host || req.headers.get('host') || ''
  const tenant = host ? await resolveTenant(host) : null
  const hostelName   = tenant?.name ?? 'Your Hostel'
  const primaryColor = tenant?.branding?.primaryColor ?? '#7A3B2E'
  const logoUrl      = tenant?.branding?.logoUrl ?? null

  const proto   = host.includes('localhost') ? 'http' : 'https'
  const baseUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL ?? '')
  const resetUrl = `${baseUrl}/reset-password?email=${encodeURIComponent(email)}`

  const admin = createAdminClient()

  try {
    const { data, error } = await (admin as any).auth.admin.generateLink({
      type:    'magiclink',
      email,
      options: { redirectTo: resetUrl },
    })

    // No such user (or generateLink failed) — respond ok anyway, no enumeration.
    const otp = data?.properties?.email_otp as string | undefined
    if (error || !otp) {
      return NextResponse.json({ ok: true })
    }

    await sendEmail({
      to:         email,
      subject:    `Reset your ${hostelName} password`,
      senderName: hostelName,
      html:       passwordResetHtml({
        hostelName,
        primaryColor,
        logoUrl,
        resetCode: otp,
        resetUrl,
      }),
    })
  } catch (err) {
    console.error('[forgot-password]', err instanceof Error ? err.message : err)
    // Still ok — don't leak server state to the client.
  }

  return NextResponse.json({ ok: true })
}
