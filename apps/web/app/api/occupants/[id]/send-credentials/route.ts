import { NextResponse, type NextRequest } from 'next/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { sendEmail, portalCredentialsHtml } from '@/lib/email'

/**
 * POST /api/occupants/[id]/send-credentials
 *
 * Provisions a Supabase auth user for the occupant if one doesn't yet exist,
 * sets a strong temporary password on it, and emails the credentials.
 *
 * We deliberately avoid Supabase magic-link / OTP flows here: Gmail and
 * Outlook safe-link scanners pre-fetch every URL in an email and Supabase's
 * verify tokens are single-use, so the scanner burns the token before the
 * human can click. A username + password pair survives that prefetch.
 *
 * The owner can resend the invite at any time; that rotates the password.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = await createTenantAdminClientFromHeaders()

  // Fetch occupant
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

  // Resolve tenant URLs
  const { data: tenantRow } = await admin
    .from('tenants')
    .select('name, slug, custom_domain, primary_color, logo_url')
    .eq('id', tenantId)
    .maybeSingle()

  const appDomain  = process.env.APP_DOMAIN ?? process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'
  const tenantBase = tenantRow?.custom_domain
    ? `https://${tenantRow.custom_domain}`
    : tenantRow?.slug
      ? `https://${tenantRow.slug}.${appDomain}`
      : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')

  const loginUrl          = `${tenantBase}/login?next=${encodeURIComponent('/occupant-portal/profile')}`
  const changePasswordUrl = `${tenantBase}/auth/set-password?next=/occupant-portal/profile`

  // Find or create the auth user for this occupant
  let authUserId: string | null = occupant.user_id ?? null

  if (!authUserId) {
    // Look up by email — could be a leftover from a previous attempt
    const { data: { users } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const found = users.find(u => u.email?.toLowerCase() === occupant.email!.toLowerCase())
    if (found) {
      authUserId = found.id
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email:         occupant.email,
        email_confirm: true,
        user_metadata: {
          first_name:  occupant.first_name,
          last_name:   occupant.last_name,
          portal_type: 'occupant',
          tenant_id:   tenantId,
          must_change_password: true,
        },
      })
      if (createErr || !created.user) {
        return NextResponse.json({ error: createErr?.message ?? 'Failed to create user' }, { status: 500 })
      }
      authUserId = created.user.id
    }
  }

  // Set/rotate temp password
  const tempPassword = generatePassword(14)
  const { error: updateAuthErr } = await admin.auth.admin.updateUserById(authUserId, {
    password:      tempPassword,
    email_confirm: true,
    user_metadata: { must_change_password: true },
  })

  if (updateAuthErr) {
    return NextResponse.json({ error: `Failed to set temporary password: ${updateAuthErr.message}` }, { status: 500 })
  }

  // Kill any existing sessions so a lingering cookie can't bypass the
  // forced-password-change guard in middleware. The user must re-login with
  // the new temp password and will then be routed through /auth/set-password.
  try { await admin.auth.admin.signOut(authUserId, 'global') } catch { /* best-effort */ }

  // Link auth user to occupant + flag portal active
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
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const delivery = await sendEmail({
    to:      occupant.email,
    subject: `${tenantRow?.name ?? 'Resident portal'} — your access details`,
    html:    portalCredentialsHtml({
      hostelName:        tenantRow?.name ?? 'Hostel',
      primaryColor:      tenantRow?.primary_color ?? '#1B4F72',
      logoUrl:           (tenantRow as any)?.logo_url ?? null,
      firstName:         occupant.first_name,
      email:             occupant.email,
      password:          tempPassword,
      loginUrl,
      changePasswordUrl,
    }),
  })

  if (!delivery.ok) {
    return NextResponse.json({
      error:
        `Email could not be delivered: ${delivery.error ?? 'unknown error'}. ` +
        `Share these credentials manually — Email: ${occupant.email}, Temporary password: ${tempPassword}`,
    }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    message: `Portal credentials sent to ${occupant.email}.`,
  }, { status: 200 })
}

function generatePassword(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#%&*'
  const arr = new Uint32Array(length)
  globalThis.crypto.getRandomValues(arr)
  return Array.from(arr, n => chars[n % chars.length]).join('')
}
