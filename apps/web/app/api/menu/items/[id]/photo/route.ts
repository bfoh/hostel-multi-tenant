import { NextResponse, type NextRequest } from 'next/server'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

const ALLOWED = new Set(['image/jpeg','image/png','image/webp'])

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
  const ctx = await requireTenantRole(tenantId, ['owner','manager'])
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: 'Max 2 MB' }, { status: 400 })
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: `Bad type ${file.type}` }, { status: 400 })

  const safeName = (file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60)) || 'photo'
  const path     = `${tenantId}/menu/${id}/${Date.now()}_${safeName}`
  const buf      = Buffer.from(await file.arrayBuffer())

  const admin = await createTenantAdminClientFromHeaders() as any
  const { error: upErr } = await admin.storage.from('menu-photos').upload(path, buf, {
    contentType: file.type, upsert: false,
  })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: pub } = admin.storage.from('menu-photos').getPublicUrl(path)
  const photo_url = pub?.publicUrl ?? null

  const { error: updErr } = await admin.from('menu_items')
    .update({ photo_url, updated_at: new Date().toISOString() })
    .eq('id', id).eq('tenant_id', tenantId)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ photo_url })
}
