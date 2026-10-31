import { NextResponse, type NextRequest } from 'next/server'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { onboardingLimiter, enforceRateLimit } from '@/lib/rate-limit'
import { LISTING_IMAGE_EXT, sniffListingImage } from '@/lib/image-type'

// The tenant-photos bucket's own limit (migration 127).
const MAX_BYTES = 5 * 1024 * 1024

/**
 * POST /api/settings/listing/cover
 * Uploads a new cover photo for the property's public listing and points
 * tenants.hero_image_url at it — the photo marketplace cards and the
 * listing gallery lead with. Owner or manager only. Each upload gets its
 * own file, so the previous cover is never overwritten in place; the
 * listing switches only once the new file is stored.
 */
export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(onboardingLimiter, req, 'listing-cover')
  if (limited) return limited

  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
  const ctx = await requireTenantRole(tenantId, ['owner', 'manager'])
  if (ctx instanceof NextResponse) return ctx

  const form = await req.formData().catch(() => null)
  const file = form?.get('photo')
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Choose a photo to upload' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'The photo must be under 5 MB' }, { status: 400 })

  const bytes = new Uint8Array(await file.arrayBuffer())
  const type = sniffListingImage(bytes)
  if (!type) return NextResponse.json({ error: 'Use a JPEG, PNG or WebP photo' }, { status: 400 })

  const admin = await createTenantAdminClientFromHeaders() as any
  const path = `${tenantId}/cover-${Date.now()}.${LISTING_IMAGE_EXT[type]}`
  const { error: upErr } = await admin.storage.from('tenant-photos').upload(path, bytes, {
    contentType: type, upsert: false,
  })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: pub } = admin.storage.from('tenant-photos').getPublicUrl(path)
  const heroImageUrl = pub?.publicUrl as string | undefined
  if (!heroImageUrl) return NextResponse.json({ error: 'Failed to resolve photo URL' }, { status: 500 })

  const { error: updErr } = await admin
    .from('tenants')
    .update({ hero_image_url: heroImageUrl })
    .eq('id', tenantId)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ hero_image_url: heroImageUrl })
}
