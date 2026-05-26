import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

const updateSchema = z.object({
  name:       z.string().min(1).max(80).optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
  is_active:  z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
  const ctx = await requireTenantRole(tenantId, ['owner','manager'])
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  const json   = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 422 })

  const admin = await createTenantAdminClientFromHeaders() as any
  const { error } = await admin.from('menu_categories')
    .update(parsed.data).eq('id', id).eq('tenant_id', tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
  const ctx = await requireTenantRole(tenantId, ['owner','manager'])
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  const admin = await createTenantAdminClientFromHeaders() as any
  const { error } = await admin.from('menu_categories').delete().eq('id', id).eq('tenant_id', tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
