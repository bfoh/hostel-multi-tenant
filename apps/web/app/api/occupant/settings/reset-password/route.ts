import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveTenant } from '@/lib/tenant/resolve'
import { sendEmail, passwordResetHtml } from '@/lib/email'

/**
 * POST /api/occupant/settings/reset-password
 *
 * Sends the signed-in occupant a tenant-branded password-reset email
 * (Resend, 6-digit code) instead of Supabase's unbranded reset mail.
 * Mirrors /api/auth/forgot-password.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = user.email
  if (!email) return NextResponse.json({ error: 'No email on account' }, { status: 400 })

  const host   = req.headers.get('host') ?? ''
  const tenant = host ? await resolveTenant(host) : null
  const hostelName   = tenant?.name ?? 'Your Hostel'
  const primaryColor = tenant?.branding?.primaryColor ?? '#7A3B2E'

  const proto   = host.includes('localhost') ? 'http' : 'https'
  const baseUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL ?? '')
  const resetUrl = `${baseUrl}/reset-password?email=${encodeURIComponent(email)}`

  const admin = createAdminClient()
  const { data, error } = await (admin as any).auth.admin.generateLink({
    type:    'recovery',
    email,
    options: { redirectTo: resetUrl },
  })

  const otp = data?.properties?.email_otp as string | undefined
  if (error || !otp) {
    return NextResponse.json({ error: 'Could not start password reset' }, { status: 500 })
  }

  const sent = await sendEmail({
    to:         email,
    subject:    `Reset your ${hostelName} password`,
    senderName: hostelName,
    html:       passwordResetHtml({ hostelName, primaryColor, resetCode: otp, resetUrl }),
  })
  if (!sent.ok) {
    return NextResponse.json({ error: 'Could not send reset email' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
