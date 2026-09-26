import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getServerTenantId } from '@/lib/auth/tenant'
import { onboardingLimiter, enforceRateLimit } from '@/lib/rate-limit'

/**
 * POST /api/onboarding/hero-image
 *
 * Server-side property-photo upload for the onboarding wizard's branding
 * step. Mirrors api/onboarding/logo/route.ts exactly (including writing
 * with the service-role admin client rather than the caller's session
 * client) — see that route's header comment for why: onboarding sessions'
 * JWTs have repeatedly proven unreliable for Storage RLS checks, and the
 * explicit tenant-membership check below is already the real authorization
 * decision for this write.
 */
export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(onboardingLimiter, req, 'onboarding-hero-image')
  if (limited) return limited

  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const formData = await req.formData().catch(() => null)
  const file = formData?.get('photo') as File | null
  const bodyTenantId = formData?.get('tenantId') as string | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
  if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: 'Image must be under 2 MB' }, { status: 400 })

  const admin = createAdminClient()

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

  const { data: membership } = await admin
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Not a member of this tenant' }, { status: 403 })

  const ext  = file.name.split('.').pop() ?? 'jpg'
  const path = `${tenantId}/hero.${ext}`
  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await admin.storage
    .from('tenant-photos')
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = admin.storage.from('tenant-photos').getPublicUrl(path)
  const heroImageUrl = `${publicUrl}?t=${Date.now()}`

  return NextResponse.json({ hero_image_url: heroImageUrl })
}
