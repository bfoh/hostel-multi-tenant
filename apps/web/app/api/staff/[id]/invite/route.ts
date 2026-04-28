import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { sendEmail, staffCredentialsHtml } from '@/lib/email'

/**
 * POST /api/staff/[id]/invite
 *
 * Sets a strong temporary password on the staff member's existing auth user
 * and emails them the credentials. We deliberately do NOT use a Supabase
 * magic-link / OTP — Gmail and Outlook safe-link scanners pre-fetch any URL
 * in an email, and Supabase's email tokens are single-use, so the scanner
 * burns the token before the human can click. A username + password pair
 * survives that prefetch because the password is just text in the body of
 * the email.
 *
 * The owner can resend the invite at any time; that just rotates the
 * temporary password.
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

  const member = Array.isArray(staff.member) ? staff.member[0] : staff.member
  const authUserId: string | null = (member as any)?.user_id ?? null
  if (!authUserId) {
    return NextResponse.json(
      { error: 'No auth account is linked to this staff member. Re-create the record.' },
      { status: 500 },
    )
  }

  // Resolve tenant URLs
  const { data: tenantRow } = await admin
    .from('tenants')
    .select('name, slug, custom_domain, primary_color')
    .eq('id', tenantId)
    .maybeSingle()

  const appDomain  = process.env.APP_DOMAIN ?? process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'
  const tenantBase = tenantRow?.custom_domain
    ? `https://${tenantRow.custom_domain}`
    : tenantRow?.slug
      ? `https://${tenantRow.slug}.${appDomain}`
      : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')

  const loginUrl          = `${tenantBase}/login?next=/dashboard`
  const changePasswordUrl = `${tenantBase}/auth/set-password?next=/dashboard`

  // Generate a strong temporary password
  const tempPassword = generatePassword(14)

  // Set the password on the existing auth user. This both lets them log in
  // and confirms the email so they can sign in immediately.
  const { error: updateAuthErr } = await admin.auth.admin.updateUserById(authUserId, {
    password:      tempPassword,
    email_confirm: true,
    user_metadata: { must_change_password: true },
  })

  if (updateAuthErr) {
    return NextResponse.json({ error: `Failed to set temporary password: ${updateAuthErr.message}` }, { status: 500 })
  }

  // Mark portal access active and stamp the membership invited_at
  await admin
    .from('staff_profiles')
    .update({ user_id: authUserId })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  await admin
    .from('tenant_members')
    .update({ invited_at: new Date().toISOString() })
    .eq('id', staff.member_id)

  const delivery = await sendEmail({
    to:      staff.email,
    subject: `${tenantRow?.name ?? 'Staff portal'} — your access details`,
    html:    staffCredentialsHtml({
      hostelName:        tenantRow?.name ?? 'Hostel',
      primaryColor:      tenantRow?.primary_color ?? '#1B4F72',
      firstName:         staff.first_name,
      email:             staff.email,
      password:          tempPassword,
      loginUrl,
      changePasswordUrl,
    }),
  })

  if (!delivery.ok) {
    return NextResponse.json({
      error:
        `Email could not be delivered: ${delivery.error ?? 'unknown error'}. ` +
        `Share these credentials manually — Email: ${staff.email}, Temporary password: ${tempPassword}`,
    }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    message: `Invite sent to ${staff.email}.`,
  }, { status: 200 })
}

/** URL-safe-ish password using readable charset (no 0/O/1/I/l confusion). */
function generatePassword(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#%&*'
  const arr = new Uint32Array(length)
  // Node 20+ has globalThis.crypto.getRandomValues
  globalThis.crypto.getRandomValues(arr)
  return Array.from(arr, n => chars[n % chars.length]).join('')
}
