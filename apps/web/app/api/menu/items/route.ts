import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

const createSchema = z.object({
  category_id:   z.string().uuid().nullable().optional(),
  name:          z.string().min(1).max(120),
  description:   z.string().max(500).nullable().optional(),
  price_pesewas: z.number().int().min(1),
  is_available:  z.boolean().default(true),
  is_sold_out:   z.boolean().default(false),
  publish_date:  z.string().nullable().optional(),
  sort_order:    z.number().int().min(0).max(9999).default(0),
})

export async function GET() {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
  const ctx = await requireTenantRole(tenantId, ['owner','manager','housekeeper','receptionist','accountant'])
  if (ctx instanceof NextResponse) return ctx

  const admin = await createTenantAdminClientFromHeaders() as any
  const { data } = await admin.from('menu_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('sort_order')
    .limit(500)
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
  const ctx = await requireTenantRole(tenantId, ['owner','manager'])
  if (ctx instanceof NextResponse) return ctx

  const json   = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 422 })

  const admin = await createTenantAdminClientFromHeaders() as any
  const { data, error } = await admin.from('menu_items')
    .insert({ tenant_id: tenantId, ...parsed.data })
    .select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
