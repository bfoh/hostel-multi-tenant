import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getServerTenantId } from '@/lib/auth/tenant'
import { onboardingLimiter, enforceRateLimit } from '@/lib/rate-limit'

/**
 * POST /api/onboarding/logo
 *
 * Server-side logo upload for the onboarding wizard's branding step.
 *
 * Moving this off a direct browser-side Storage call (see git history) did
 * not fix the "new row violates row-level security policy" error some
 * owners hit here — the real cause is JWT staleness, not request origin.
 * public.tenant_id() (used by tenant_members' own SELECT policy, which the
 * tenant-logos INSERT policy's membership subquery depends on — see
 * migration 113) reads tenant_id from the JWT's claims, not a live lookup.
 * Those claims are stamped by custom_access_token_hook (migration 044) at
 * token-mint time. A user's access token minted at signup — before
 * provisionTenant() created their tenant_members row — has no tenant_id
 * claim at all, and the wizard can be reached on that same stale token
 * (auth/callback's own refreshSession() call can be dropped by an
 * intermediate redirect). Refreshing the session here, right before the
 * RLS-gated write, guarantees an up-to-date claim regardless of how the
 * caller got here.
 */
export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(onboardingLimiter, req, 'onboarding-logo')
  if (limited) return limited

  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  // Mint a fresh access token so RLS checks that read tenant_id/tenant_role
  // from JWT claims (see header comment) see current tenant_members state,
  // not whatever was true when this session's token was originally issued.
  await supabaseAuth.auth.refreshSession()

  const formData = await req.formData().catch(() => null)
  const file = formData?.get('logo') as File | null
  const bodyTenantId = formData?.get('tenantId') as string | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
  if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: 'Image must be under 2 MB' }, { status: 400 })

  const admin = createAdminClient()

  // Resolve tenant the same way /api/onboarding/identity does: header first
  // (set by middleware once the subdomain resolves), then the value the
  // wizard already has client-side, then a tenant_members lookup by user.
  let tenantId = await getServerTenantId() ?? bodyTenantId ?? null
  if (!tenantId) {
    const { data: m } = await admin
      .from('tenant_members')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    tenantId = m?.tenant_id ?? null
  }
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  // Defense in depth: confirm the caller is actually an active member of the
  // tenant they claim (bodyTenantId is client-supplied) before writing.
  const { data: membership } = await admin
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Not a member of this tenant' }, { status: 403 })

  const ext  = file.name.split('.').pop() ?? 'png'
  const path = `${tenantId}/logo.${ext}`
  const bytes = await file.arrayBuffer()

  // Use the user's own session client for the Storage write — Storage RLS
  // still applies, but the server-side client reliably carries the
  // authenticated session (see this route's header comment).
  const { error: uploadError } = await supabaseAuth.storage
    .from('tenant-logos')
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (uploadError) {
    // The refreshSession() above is our best fix for the known JWT-staleness
    // cause (see header comment), but if this still fails, surface exactly
    // what the RLS check saw instead of leaving a bare Postgres message —
    // one more blind guess isn't useful after two failed fix attempts.
    let claimTenantId: string | null = null
    try {
      const { data: { session } } = await supabaseAuth.auth.getSession()
      const payloadB64 = session?.access_token.split('.')[1]
      if (payloadB64) {
        const json = Buffer.from(payloadB64, 'base64').toString('utf8')
        claimTenantId = JSON.parse(json).tenant_id ?? null
      }
    } catch { /* best-effort diagnostic only */ }

    const { data: visibleMembership } = await supabaseAuth
      .from('tenant_members')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json({
      error: uploadError.message,
      debug: { tenantId, claimTenantId, visibleUnderOwnSession: !!visibleMembership },
    }, { status: 500 })
  }

  const { data: { publicUrl } } = supabaseAuth.storage.from('tenant-logos').getPublicUrl(path)
  const logoUrl = `${publicUrl}?t=${Date.now()}`

  return NextResponse.json({ logo_url: logoUrl })
}
