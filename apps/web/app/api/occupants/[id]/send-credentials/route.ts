import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

// POST /api/occupants/[id]/send-credentials
// Sends an invite email via Supabase's built-in email system.
// The occupant clicks the link, gets signed in, and is redirected to
// change their password before accessing the portal.
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
    .single()

  if (occError || !occupant) {
    return NextResponse.json({ error: 'Occupant not found' }, { status: 404 })
  }
  if (!occupant.email) {
    return NextResponse.json({ error: 'Occupant has no email address. Add one first.' }, { status: 422 })
  }
  if (occupant.user_id) {
    return NextResponse.json({ error: 'Occupant already has a portal account' }, { status: 409 })
  }

  // Resolve the tenant's own domain so the invite link lands on their portal,
  // not the generic platform login page.
  const { data: tenantRow } = await admin
    .from('tenants')
    .select('slug, custom_domain')
    .eq('id', tenantId)
    .single()

  const appDomain  = process.env.APP_DOMAIN ?? process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'
  const tenantBase = tenantRow?.custom_domain
    ? `https://${tenantRow.custom_domain}`
    : tenantRow?.slug
      ? `https://${tenantRow.slug}.${appDomain}`
      : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')

  const invitePayload = {
    data: {
      first_name:  occupant.first_name,
      last_name:   occupant.last_name,
      portal_type: 'occupant',
      tenant_id:   tenantId,
    },
    // After accepting the invite the user is taken to set their password
    redirectTo: `${tenantBase}/auth/invite`,
  }

  // ── Send invite (Supabase handles the email) ───────────────────────────────
  let { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    occupant.email,
    invitePayload,
  )

  // ── Ghost-user recovery ────────────────────────────────────────────────────
  // A previous invite left a dangling auth.users record. Find it, clean it up,
  // and re-send.
  if (inviteError?.message?.toLowerCase().includes('already')) {
    const { data: { users } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const ghost = users.find(u => u.email?.toLowerCase() === occupant.email!.toLowerCase())

    if (!ghost) {
      return NextResponse.json(
        { error: 'An account with this email exists but could not be located. Contact support.' },
        { status: 409 }
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

    // Unconfirmed ghost — delete and re-invite cleanly
    await admin.auth.admin.deleteUser(ghost.id)

    const retry = await admin.auth.admin.inviteUserByEmail(occupant.email, invitePayload)
    if (retry.error || !retry.data) {
      return NextResponse.json({ error: retry.error?.message ?? 'Failed to send invite' }, { status: 500 })
    }
    invited = retry.data
    inviteError = null
  }

  if (inviteError || !invited) {
    return NextResponse.json({ error: inviteError?.message ?? 'Invite failed' }, { status: 500 })
  }

  // ── Link auth user to occupant record ─────────────────────────────────────
  const { error: updateError } = await admin
    .from('occupants')
    .update({
      user_id:               invited.user!.id,
      portal_enabled:        true,
      portal_invite_sent_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (updateError) {
    await admin.auth.admin.deleteUser(invited.user!.id)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    message: `Portal invite sent to ${occupant.email}. They will be asked to set their password when they open the email.`,
  }, { status: 200 })
}
