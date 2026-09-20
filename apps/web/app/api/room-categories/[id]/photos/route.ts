import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_PHOTOS = 12

/**
 * POST /api/room-categories/[id]/photos
 * Appends one uploaded photo to room_categories.image_urls — the same
 * array already read by every public booking surface (/api/public/[slug]/
 * rooms, /book, /hostels/[slug]).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
  const ctx = await requireTenantRole(tenantId, ['owner', 'manager'])
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  const admin = await createTenantAdminClientFromHeaders() as any

  const { data: category } = await admin
    .from('room_categories')
    .select('id, image_urls')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()
  if (!category) return NextResponse.json({ error: 'Room type not found' }, { status: 404 })

  const existing = (category.image_urls ?? []) as string[]
  if (existing.length >= MAX_PHOTOS) {
    return NextResponse.json({ error: `Maximum ${MAX_PHOTOS} photos per room type` }, { status: 400 })
  }

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'Max 4 MB' }, { status: 400 })
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: `Unsupported file type ${file.type}` }, { status: 400 })

  const safeName = (file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60)) || 'photo'
  const path = `${tenantId}/room-categories/${id}/${Date.now()}_${safeName}`
  const buf = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await admin.storage.from('room-photos').upload(path, buf, {
    contentType: file.type, upsert: false,
  })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: pub } = admin.storage.from('room-photos').getPublicUrl(path)
  const photoUrl = pub?.publicUrl
  if (!photoUrl) return NextResponse.json({ error: 'Failed to resolve photo URL' }, { status: 500 })

  const image_urls = [...existing, photoUrl]
  const { error: updErr } = await admin
    .from('room_categories')
    .update({ image_urls })
    .eq('id', id)
    .eq('tenant_id', tenantId)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ image_urls })
}

const deleteSchema = z.object({ url: z.string().url() })

/**
 * DELETE /api/room-categories/[id]/photos
 * Body: { url } — removes one photo URL from image_urls.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
  const ctx = await requireTenantRole(tenantId, ['owner', 'manager'])
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'A valid url is required' }, { status: 422 })

  const admin = await createTenantAdminClientFromHeaders() as any
  const { data: category } = await admin
    .from('room_categories')
    .select('id, image_urls')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()
  if (!category) return NextResponse.json({ error: 'Room type not found' }, { status: 404 })

  const image_urls = ((category.image_urls ?? []) as string[]).filter((u) => u !== parsed.data.url)
  const { error: updErr } = await admin
    .from('room_categories')
    .update({ image_urls })
    .eq('id', id)
    .eq('tenant_id', tenantId)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  // Best-effort storage cleanup — the DB update above is the source of truth
  // for what's shown publicly, so a failure here isn't fatal. Supabase
  // storage calls resolve with { error } rather than rejecting, so no
  // try/catch is needed here — the result is simply not checked.
  const path = parsed.data.url.split('/room-photos/')[1]
  if (path) await admin.storage.from('room-photos').remove([path])

  return NextResponse.json({ image_urls })
}
