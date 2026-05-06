import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { createAdminClient } from '@/lib/supabase/admin'

const updateSchema = z.object({
  category_id:   z.string().uuid().nullable().optional(),
  name:          z.string().min(1).max(120).optional(),
  description:   z.string().max(500).nullable().optional(),
  price_pesewas: z.number().int().min(1).optional(),
  is_available:  z.boolean().optional(),
  is_sold_out:   z.boolean().optional(),
  publish_date:  z.string().nullable().optional(),
  sort_order:    z.number().int().min(0).max(9999).optional(),
})

// Kitchen-only fields housekeeper may toggle
const KITCHEN_FIELDS = new Set(['is_available', 'is_sold_out'])

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const json   = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 422 })

  const fields = Object.keys(parsed.data) as (keyof typeof parsed.data)[]
  const onlyKitchen = fields.every(f => KITCHEN_FIELDS.has(f as string))

  const allowedRoles = onlyKitchen
    ? ['owner', 'manager', 'housekeeper'] as const
    : ['owner', 'manager'] as const

  const ctx = await requireTenantRole(tenantId, allowedRoles)
  if (ctx instanceof NextResponse) return ctx

  const admin = createAdminClient() as any
  const { error } = await admin.from('menu_items')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', (await params).id).eq('tenant_id', tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
  const ctx = await requireTenantRole(tenantId, ['owner','manager'])
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  const admin = createAdminClient() as any

  // Try hard delete first. After migration 063 the FK is ON DELETE SET NULL
  // so this always succeeds. Pre-migration, fall back to soft-delete (mark
  // unavailable) if the FK to food_order_items blocks the delete.
  const { error } = await admin.from('menu_items').delete().eq('id', id).eq('tenant_id', tenantId)
  if (!error) {
    return NextResponse.json({ ok: true })
  }

  const isFkViolation = (error as any).code === '23503'
  if (!isFkViolation) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fallback: soft-delete by hiding from menu. Past orders remain intact.
  const { error: softErr } = await admin.from('menu_items')
    .update({ is_available: false, is_sold_out: true, updated_at: new Date().toISOString() })
    .eq('id', id).eq('tenant_id', tenantId)
  if (softErr) {
    return NextResponse.json({ error: softErr.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, soft_deleted: true })
}
