import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { sendEmail, inviteHtml } from '@/lib/email'

/**
 * POST /api/staff/[id]/invite
 *
 * Issues a magic-link sign-in for an existing staff member and emails it via
 * Resend. The auth user + tenant_members row already exist (POST /api/staff
 * creates them eagerly because tenant_members.user_id is NOT NULL), but the
 * "portal active" signal — staff_profiles.user_id — stays null until this
 * endpoint runs, so the dashboard badge only flips after the owner explicitly
 * sends the invite.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: staff, error: staffError } = await admin
    .from('staff_profiles')
    .select('id, first_name, last_name, email, user_id, member_id, member:tenant_members(user_id, role, invited_at)')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (staffError || !staff) {
    return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
  }
  if (!staff.email) {
    return NextResponse.json({ error: 'Staff member has no email address' }, { status: 422 })
  }
  if (staff.user_id) {
    return NextResponse.json({ error: 'Invite already sent for this staff member.' }, { status: 409 })
  }

  const member = Array.isArray(staff.member) ? staff.member[0] : staff.member
  const authUserId: string | null = (member as any)?.user_id ?? null
  if (!authUserId) {
    return NextResponse.json(
      { error: 'No auth account is linked to this staff member. Re-create the record.' },
      { status: 500 },
    )
  }

  const { data: tenantRow } = await admin
    .from('tenants')
    .select('name, slug, custom_domain, primary_color')
    .eq('id', tenantId)
    .maybeSingle()

  // The invite link MUST point at a URL whitelisted in Supabase Auth → Redirect
  // URLs. Tenant subdomains and custom domains are not in that allow list, so
  // Supabase silently swaps any non-whitelisted redirect_to for the project's
  // Site URL, and the user lands on the platform homepage instead of the
  // /auth/invite handler. We send them to the root domain instead — the
  // /auth/invite page reads tenant_domain / tenant_slug from the refreshed
  // JWT and forwards them to the right hostel host.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? `https://${process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'}`
  const redirectTo = `${appUrl}/auth/invite`

  // The auth user already exists (created by POST /api/staff), so we use a
  // magic-link rather than a fresh "invite" link, which would error with
  // "User already registered". The magic link signs them in immediately;
  // they can set a password from Settings → Security after.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type:  'magiclink',
    email: staff.email,
    options: { redirectTo },
  })

  if (linkError || !linkData) {
    return NextResponse.json({ error: linkError?.message ?? 'Failed to create invite link' }, { status: 500 })
  }

  const otpCode = (linkData.properties as any)?.email_otp as string | undefined
  if (!otpCode) {
    return NextResponse.json({ error: 'Invite code missing from Supabase response' }, { status: 500 })
  }

  // We send the user to OUR /auth/verify-otp page (with the email prefilled)
  // instead of the raw Supabase action_link. Email-client safe-link scanners
  // pre-fetch URLs and burn single-use Supabase tokens before the human
  // clicks. Code-entry pages survive that prefetch because bots don't type
  // codes into forms.
  const verifyUrl = `${appUrl}/auth/verify-otp?email=${encodeURIComponent(staff.email)}`

  // Mark portal access active by linking the auth user to the staff profile,
  // and stamp the membership invited_at so we can distinguish "just created"
  // from "invite sent" in the future.
  await admin
    .from('staff_profiles')
    .update({ user_id: authUserId })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  await admin
    .from('tenant_members')
    .update({ invited_at: new Date().toISOString() })
    .eq('id', staff.member_id)

  // Deliver via Resend — surface failures so the dashboard can show a real
  // error instead of "invite sent" when the email never went out.
  const delivery = await sendEmail({
    to:      staff.email,
    subject: `${tenantRow?.name ?? 'Staff portal'} — accept your invitation`,
    html:    inviteHtml({
      hostelName:   tenantRow?.name ?? 'Hostel',
      primaryColor: tenantRow?.primary_color ?? '#1B4F72',
      firstName:    staff.first_name,
      portalLabel:  'staff dashboard',
      verifyUrl,
      otpCode,
    }),
  })

  if (!delivery.ok) {
    return NextResponse.json({
      error: `Email could not be delivered: ${delivery.error ?? 'unknown error'}. Code (valid 1 hour): ${otpCode}`,
    }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    message: `Invite sent to ${staff.email}.`,
  }, { status: 200 })
}
