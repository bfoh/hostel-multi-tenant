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
 * The wizard previously uploaded directly from the browser straight to the
 * tenant-logos Storage bucket, the only place in this codebase that did a
 * Storage write straight from client-side JS — every
 * other upload (see app/api/settings/logo/route.ts) goes through a
 * server-side route like this one. That direct-from-browser call
 * consistently failed onboarding's tenant-logos RLS check ("new row
 * violates row-level security policy") even after the path format was
 * fixed to match the bucket's {tenant_id}/logo.{ext} convention — the
 * wizard runs on the tenant's own subdomain immediately after a fresh
 * email-confirmation redirect, and something about that specific
 * browser-side session context wasn't reliably authenticating the direct
 * Storage call, unlike this same request made server-side (which is
 * exactly how the wizard's other steps, e.g. /api/onboarding/identity,
 * already work reliably in this same flow). Routing through the server
 * sidesteps the whole class of problem rather than continuing to chase the
 * exact browser-side auth failure mode.
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
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabaseAuth.storage.from('tenant-logos').getPublicUrl(path)
  const logoUrl = `${publicUrl}?t=${Date.now()}`

  return NextResponse.json({ logo_url: logoUrl })
}
