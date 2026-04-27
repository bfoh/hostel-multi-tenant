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

  const { data: tenantRow } = await admin
    .from('tenants')
    .select('name, slug, custom_domain, primary_color')
    .eq('id', tenantId)
    .maybeSingle()

  // Always use the platform root domain — tenant subdomains / custom domains
  // are not in Supabase's "Redirect URLs" allow list, so passing them as
  // redirect_to causes Supabase to silently fall back to the Site URL and
  // bounces the user to the platform marketing page instead of /auth/invite.
  // The /auth/invite client component reads the tenant from the refreshed
  // JWT and forwards to the correct hostel host.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? `https://${process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'}`
  const redirectTo = `${appUrl}/auth/invite`

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

  const otpCode    = (linkData.properties as any)?.email_otp as string | undefined
  const authUserId = linkData.user?.id

  if (!otpCode || !authUserId) {
    return NextResponse.json({ error: 'Invite code missing from Supabase response' }, { status: 500 })
  }

  // Send to our scanner-safe code-entry page rather than the raw Supabase
  // action_link, which gets burned by Gmail/Outlook safe-link prefetchers.
  const verifyUrl = `${appUrl}/auth/verify-otp?email=${encodeURIComponent(occupant.email)}`

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
  const delivery = await sendEmail({
    to:      occupant.email,
    subject: `${tenantRow?.name ?? 'Resident portal'} — accept your invitation`,
    html:    inviteHtml({
      hostelName:   tenantRow?.name ?? 'Hostel',
      primaryColor: tenantRow?.primary_color ?? '#1B4F72',
      firstName:    occupant.first_name,
      portalLabel:  'resident portal',
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
    message: `Portal invite sent to ${occupant.email}. The link expires in 1 hour.`,
  }, { status: 200 })
}
