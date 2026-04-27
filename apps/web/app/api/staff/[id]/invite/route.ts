import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { sendEmail, inviteHtml } from '@/lib/email'

// POST /api/staff/[id]/invite — create Supabase auth account and send invite email
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  // Fetch the staff record (admin client bypasses RLS)
  const { data: staff, error: staffError } = await admin
    .from('staff_profiles')
    .select('id, first_name, last_name, email, user_id, member:tenant_members(role)')
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
    return NextResponse.json({ error: 'Staff member already has a login account' }, { status: 409 })
  }

  // Resolve the tenant URL so the invite link lands on their domain
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

  const redirectTo = `${tenantBase}/auth/invite`

  const memberRec = Array.isArray(staff.member) ? staff.member[0] : staff.member
  const staffRole = (memberRec as any)?.role ?? 'staff'

  // Generate the invite link WITHOUT triggering Supabase's built-in mailer
  // (which is rate-limited / unconfigured in most projects). We send the
  // email ourselves through Resend below.
  let { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type:  'invite',
    email: staff.email,
    options: {
      data: {
        first_name:  staff.first_name,
        last_name:   staff.last_name,
        portal_type: 'staff',
        tenant_id:   tenantId,
      },
      redirectTo,
    },
  })

  // ── Ghost-user recovery ────────────────────────────────────────────────────
  // If the email already has an auth.users row from a previous failed invite,
  // generate_link returns "User already registered". Find the row and either
  // re-link or delete + retry.
  if (linkError?.message?.toLowerCase().includes('already')) {
    const { data: { users } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const ghost = users.find(u => u.email?.toLowerCase() === staff.email!.toLowerCase())

    if (!ghost) {
      return NextResponse.json(
        { error: 'An account with this email exists but could not be located. Contact support.' },
        { status: 409 },
      )
    }

    if (ghost.email_confirmed_at && ghost.last_sign_in_at) {
      // Active confirmed user — link without re-sending
      await admin.from('tenant_members').upsert({
        tenant_id: tenantId, user_id: ghost.id, role: staffRole, is_active: true,
      }, { onConflict: 'tenant_id,user_id' })
      await admin.from('staff_profiles')
        .update({ user_id: ghost.id })
        .eq('id', id).eq('tenant_id', tenantId)
      return NextResponse.json({
        ok: true,
        message: `Linked existing account (${staff.email}) to staff record. They can log in now.`,
      }, { status: 200 })
    }

    // Unconfirmed ghost — delete + retry
    await admin.auth.admin.deleteUser(ghost.id)

    const retry = await admin.auth.admin.generateLink({
      type: 'invite', email: staff.email, options: {
        data: { first_name: staff.first_name, last_name: staff.last_name, portal_type: 'staff', tenant_id: tenantId },
        redirectTo,
      },
    })
    if (retry.error || !retry.data) {
      return NextResponse.json({ error: retry.error?.message ?? 'Failed to create invite link' }, { status: 500 })
    }
    linkData = retry.data
    linkError = null
  }

  if (linkError || !linkData) {
    return NextResponse.json({ error: linkError?.message ?? 'Failed to create invite link' }, { status: 500 })
  }

  const inviteUrl = linkData.properties?.action_link
  const authUserId = linkData.user?.id

  if (!inviteUrl || !authUserId) {
    return NextResponse.json({ error: 'Invite link missing from Supabase response' }, { status: 500 })
  }

  // Upsert tenant_members so JWT hook picks up tenant context on login
  await admin
    .from('tenant_members')
    .upsert({
      tenant_id: tenantId,
      user_id:   authUserId,
      role:      staffRole,
      is_active: true,
    }, { onConflict: 'tenant_id,user_id' })

  // Link auth user to staff record
  await admin
    .from('staff_profiles')
    .update({ user_id: authUserId })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  // Send the invite email via Resend (bypasses Supabase's built-in mailer)
  await sendEmail({
    to:      staff.email,
    subject: `${tenantRow?.name ?? 'Staff portal'} — accept your invitation`,
    html:    inviteHtml({
      hostelName:   tenantRow?.name ?? 'Hostel',
      primaryColor: tenantRow?.primary_color ?? '#1B4F72',
      firstName:    staff.first_name,
      portalLabel:  'staff dashboard',
      inviteUrl,
    }),
  })

  return NextResponse.json({
    ok: true,
    message: `Invite sent to ${staff.email}. The link expires in 24 hours.`,
  }, { status: 200 })
}
