import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body?.email || !body?.password || !body?.hostelName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { email, password, hostelName, selectedPlan, selectedInterval } = body as {
    email:            string
    password:         string
    hostelName:       string
    selectedPlan:     string | null
    selectedInterval: string | null
  }

  const validInterval =
    selectedInterval && ['monthly', 'quarterly', 'biannual', 'annual'].includes(selectedInterval)
      ? selectedInterval
      : null

  const admin   = createAdminClient()
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
  const redirectTo = `${appUrl}/auth/callback`

  // Use generateLink so we control email delivery via Brevo — this bypasses
  // Supabase's own email hook (which can cause "Database error saving new user"
  // when a custom send_email hook is configured but misconfigured).
  const { data, error } = await admin.auth.admin.generateLink({
    type:     'signup',
    email,
    password,
    options: {
      data: {
        hostel_name: hostelName,
        ...(selectedPlan ? { selected_plan: selectedPlan } : {}),
        ...(validInterval ? { selected_interval: validInterval } : {}),
      },
      redirectTo,
    },
  })

  // Build our own confirmation URL from the token_hash so /auth/callback can
  // verify it with verifyOtp (the raw Supabase action_link relies on PKCE,
  // which breaks for admin-generated links — the click has no code_verifier).
  const confirmUrlFrom = (
    props: { hashed_token?: string; verification_type?: string; action_link?: string } | undefined,
  ) =>
    props?.hashed_token
      ? `${appUrl}/auth/confirm?token_hash=${props.hashed_token}&type=${props.verification_type ?? 'signup'}`
      : props?.action_link

  let confirmUrl = confirmUrlFrom(data?.properties as any)

  // A 'signup' link fails when the email already exists — which is common here
  // because an earlier (failed-delivery) attempt may have created an
  // unconfirmed user. Fall back to a magic-link activation so the user still
  // gets an email instead of a dead end. Clicking it confirms the account and
  // lands on /auth/callback, same as the original confirmation link.
  if (error || !confirmUrl) {
    const retry = await admin.auth.admin.generateLink({
      type:    'magiclink',
      email,
      options: { redirectTo },
    })
    const retryUrl = confirmUrlFrom(retry.data?.properties as any)
    if (retry.error || !retryUrl) {
      console.error('[signup] generateLink error:', error?.message ?? retry.error?.message)
      return NextResponse.json(
        { error: 'Could not start signup. If you already have an account, please log in instead.' },
        { status: 400 },
      )
    }
    confirmUrl = retryUrl
  }

  // Send the confirmation email via Brevo instead of through Supabase
  await sendEmail({
    to:          email,
    subject:     `Confirm your ${hostelName} account`,
    senderName:  'GH Hostels',
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

  return NextResponse.json({ ok: true })
}
