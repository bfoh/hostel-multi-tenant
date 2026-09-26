import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getServerTenantId } from '@/lib/auth/tenant'
import { onboardingLimiter, enforceRateLimit } from '@/lib/rate-limit'

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

/**
 * POST/DELETE /api/onboarding/room-photos
 *
 * Onboarding-time counterpart to /api/room-categories/[id]/photos — that
 * route needs an existing room_categories row, which doesn't exist until
 * the wizard's final submit (/api/onboarding/complete). This route is
 * stateless: it just uploads/removes an object in the same room-photos
 * bucket under a tenant-scoped "onboarding" path and hands back the public
 * URL, and the wizard collects the URLs client-side until submit, where
 * they're written into the new room_categories row's image_urls directly.
 *
 * Auth/write pattern mirrors api/onboarding/logo/route.ts (session auth +
 * explicit tenant-membership check as the real authorization gate, admin
 * client for the actual Storage write) rather than requireTenantRole/
 * createTenantAdminClientFromHeaders, since those depend on the x-tenant-id
 * header, which has proven unreliable during onboarding specifically.
 */
async function resolveTenant(admin: ReturnType<typeof createAdminClient>, userId: string, bodyTenantId: string | null) {
  let tenantId = await getServerTenantId() ?? bodyTenantId ?? null
  if (!tenantId) {
    const { data: m } = await admin
      .from('tenant_members')
      .select('tenant_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    tenantId = m?.tenant_id ?? null
  }
  if (!tenantId) return null

  const { data: membership } = await admin
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  return membership ? tenantId : null
}

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(onboardingLimiter, req, 'onboarding-room-photos')
  if (limited) return limited

  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const formData = await req.formData().catch(() => null)
  const file = formData?.get('file') as File | null
  const bodyTenantId = formData?.get('tenantId') as string | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'Image must be under 4 MB' }, { status: 400 })
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: `Unsupported file type ${file.type}` }, { status: 400 })

  const admin = createAdminClient()
  const tenantId = await resolveTenant(admin, user.id, bodyTenantId)
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const safeName = (file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60)) || 'photo'
  const path = `${tenantId}/room-categories/onboarding/${Date.now()}_${safeName}`
  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await admin.storage
    .from('room-photos')
    .upload(path, bytes, { contentType: file.type, upsert: false })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('room-photos').getPublicUrl(path)
  return NextResponse.json({ url: publicUrl })
}

const deleteSchema = z.object({ url: z.string().url(), tenantId: z.string().uuid().optional() })

export async function DELETE(req: NextRequest) {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'A valid url is required' }, { status: 422 })

  const admin = createAdminClient()
  const tenantId = await resolveTenant(admin, user.id, parsed.data.tenantId ?? null)
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  // Best-effort storage cleanup — the wizard's own local state is the
  // source of truth for what survives to final submit, so a failure here
  // isn't fatal (same precedent as api/room-categories/[id]/photos).
  const path = parsed.data.url.split('/room-photos/')[1]
  if (path) await admin.storage.from('room-photos').remove([path])

  return NextResponse.json({ ok: true })
}
