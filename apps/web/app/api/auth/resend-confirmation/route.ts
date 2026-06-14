import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { authLimiter, enforceRateLimit } from '@/lib/rate-limit'

/**
 * POST /api/auth/resend-confirmation   body: { email }
 *
 * Re-sends the account-activation email via Brevo (our provider) instead of
 * Supabase's built-in SMTP. Uses admin.generateLink({ type: 'magiclink' }),
 * which mints an activation link WITHOUT dispatching Supabase's own email;
 * clicking it confirms the email, signs the user in, and lands on
 * /auth/callback where the tenant is provisioned — same destination as the
 * original signup confirmation.
 *
 * Always responds 200 — never reveal whether an account exists.
 */
export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(authLimiter, req, 'resend-confirmation')
  if (limited) return limited

  let body: { email?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: true }) }

  const email = body.email?.trim().toLowerCase()
  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    return NextResponse.json({ ok: true })
  }

  const admin = createAdminClient()

  const host   = req.headers.get('host') ?? ''
  const proto  = host.includes('localhost') ? 'http' : 'https'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (host ? `${proto}://${host}` : '')
  const redirectTo = `${appUrl}/auth/callback`

  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type:    'magiclink',
      email,
      options: { redirectTo },
    })

    const confirmUrl = data?.properties?.action_link
    // No such user, already-confirmed edge, or generateLink failed — respond
    // ok anyway so we never leak account existence.
    if (error || !confirmUrl) {
      return NextResponse.json({ ok: true })
    }

    const hostelName = (data.user?.user_metadata?.hostel_name as string | undefined)?.trim() || 'your hostel'

    await sendEmail({
      to:         email,
      subject:    `Confirm your ${hostelName} account`,
      senderName: 'GH Hostels',
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;">
          <h2 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">Confirm your email</h2>
          <p style="font-size:14px;color:#6b7280;margin:0 0 24px;">
            Click the button below to activate your <strong>${hostelName}</strong> account on GH Hostels.
            The link expires in 24 hours.
          </p>
          <a href="${confirmUrl}"
             style="display:inline-block;padding:12px 28px;background:#D4A24C;color:#0A3729;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
            Confirm my account
          </a>
          <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;word-break:break-all;">
            Or copy this link into your browser:<br/>${confirmUrl}
          </p>
        </div>
      `,
    })
  } catch (err) {
    console.error('[resend-confirmation]', err instanceof Error ? err.message : err)
    // Still ok — don't leak server state.
  }

  return NextResponse.json({ ok: true })
}
