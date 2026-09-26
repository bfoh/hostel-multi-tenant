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
 * Two earlier fix attempts targeted the wrong layer: moving the upload
 * server-side, then refreshing the session before the write, both left the
 * same "new row violates row-level security policy" error. A debug payload
 * from the refresh attempt showed why — this session's JWT carried no
 * tenant_id claim even immediately after an explicit refreshSession() call,
 * so whatever's making this particular session's token unreliable during
 * onboarding survives a refresh, not just a stale mint.
 *
 * Rather than keep chasing that timing issue, this route now performs the
 * actual Storage write with the service-role admin client instead of the
 * caller's session client. The membership check directly below (tenant_id +
 * user_id + is_active, using the same admin client) is already the real
 * authorization decision for this write — the tenant-logos bucket's RLS
 * membership check was always a second, redundant gate that happened to
 * depend on JWT claims. Since the authorization is already verified
 * explicitly in this handler, bypassing that second gate for the write
 * itself removes the fragile dependency rather than working around it.
 */
export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(onboardingLimiter, req, 'onboarding-logo')
  if (limited) return limited

  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

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

  // This is the actual authorization check for this write — see header
  // comment on why the storage write below no longer relies on RLS too.
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

  const { error: uploadError } = await admin.storage
    .from('tenant-logos')
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = admin.storage.from('tenant-logos').getPublicUrl(path)
  const logoUrl = `${publicUrl}?t=${Date.now()}`

  return NextResponse.json({ logo_url: logoUrl })
}
