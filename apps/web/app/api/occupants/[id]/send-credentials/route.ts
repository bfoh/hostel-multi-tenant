import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { sendEmail, inviteHtml } from '@/lib/email'

// POST /api/occupants/[id]/send-credentials
// Generates a Supabase invite link and emails it through Resend.
// We deliver the email ourselves so delivery doesn't depend on Supabase's
// built-in mailer (which is heavily rate-limited and almost always unwired
// in production projects).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  // ── Fetch occupant ─────────────────────────────────────────────────────────
  const { data: occupant, error: occError } = await admin
    .from('occupants')
    .select('id, first_name, last_name, email, phone, user_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (occError || !occupant) {
    return NextResponse.json({ error: 'Occupant not found' }, { status: 404 })
  }
  if (!occupant.email) {
    return NextResponse.json({ error: 'Occupant has no email address. Add one first.' }, { status: 422 })
  }
  if (occupant.user_id) {
    return NextResponse.json({ error: 'Occupant already has a portal account' }, { status: 409 })
  }

  // Resolve the tenant's own domain so the invite link lands on their portal
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

  const linkOptions = {
    data: {
      first_name:  occupant.first_name,
      last_name:   occupant.last_name,
      portal_type: 'occupant',
      tenant_id:   tenantId,
    },
    redirectTo,
  }

  let { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'invite', email: occupant.email, options: linkOptions,
  })

  // ── Ghost-user recovery ────────────────────────────────────────────────────
  if (linkError?.message?.toLowerCase().includes('already')) {
    const { data: { users } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const ghost = users.find(u => u.email?.toLowerCase() === occupant.email!.toLowerCase())

    if (!ghost) {
      return NextResponse.json(
        { error: 'An account with this email exists but could not be located. Contact support.' },
        { status: 409 },
      )
    }

    if (ghost.email_confirmed_at && ghost.last_sign_in_at) {
      // Active confirmed user — just link without re-sending
      await admin.from('occupants')
        .update({ user_id: ghost.id, portal_enabled: true, portal_invite_sent_at: new Date().toISOString() })
        .eq('id', id).eq('tenant_id', tenantId)
      return NextResponse.json({
        ok: true,
        message: `Portal access linked to existing account for ${occupant.email}. They can log in now.`,
      }, { status: 200 })
    }

    // Unconfirmed ghost — delete and re-issue cleanly
    await admin.auth.admin.deleteUser(ghost.id)

    const retry = await admin.auth.admin.generateLink({
      type: 'invite', email: occupant.email, options: linkOptions,
    })
    if (retry.error || !retry.data) {
      return NextResponse.json({ error: retry.error?.message ?? 'Failed to create invite link' }, { status: 500 })
    }
    linkData = retry.data
    linkError = null
  }

  if (linkError || !linkData) {
    return NextResponse.json({ error: linkError?.message ?? 'Invite failed' }, { status: 500 })
  }

  const inviteUrl  = linkData.properties?.action_link
  const authUserId = linkData.user?.id

  if (!inviteUrl || !authUserId) {
    return NextResponse.json({ error: 'Invite link missing from Supabase response' }, { status: 500 })
  }

  // ── Link auth user to occupant record ─────────────────────────────────────
  const { error: updateError } = await admin
    .from('occupants')
    .update({
      user_id:               authUserId,
      portal_enabled:        true,
      portal_invite_sent_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (updateError) {
    await admin.auth.admin.deleteUser(authUserId)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // ── Deliver via Resend ─────────────────────────────────────────────────────
  await sendEmail({
    to:      occupant.email,
    subject: `${tenantRow?.name ?? 'Resident portal'} — accept your invitation`,
    html:    inviteHtml({
      hostelName:   tenantRow?.name ?? 'Hostel',
      primaryColor: tenantRow?.primary_color ?? '#1B4F72',
      firstName:    occupant.first_name,
      portalLabel:  'resident portal',
      inviteUrl,
    }),
  })

  return NextResponse.json({
    ok: true,
    message: `Portal invite sent to ${occupant.email}. The link expires in 24 hours.`,
  }, { status: 200 })
}
