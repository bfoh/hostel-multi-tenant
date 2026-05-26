import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'

const schema = z.object({
  name:        z.string().min(2).max(100).optional(),
  type:        z.enum(['single', 'double', 'twin', 'triple', 'quad', 'dormitory', 'suite', 'studio']).optional(),
  base_rate:   z.number().int().min(1).optional(),
  rate_unit:   z.enum(['night', 'week', 'month', 'semester']).optional(),
  capacity:    z.number().int().min(1).max(20).optional(),
  description: z.string().max(500).nullable().optional(),
  amenities:   z.array(z.string()).optional(),
  is_active:   z.boolean().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const tenantId = await getServerTenantId()
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 401 })
  }

  const supabase = await createTenantAdminClientFromHeaders()
  const { data, error } = await supabase
    .from('room_categories')
    .update(parsed.data)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const tenantId = await getServerTenantId()
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 401 })
  }

  const supabase = await createTenantAdminClientFromHeaders()

  // Check if rooms reference this category
  const { count } = await supabase
    .from('rooms')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)
    .eq('tenant_id', tenantId)

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${count} room(s) still use this type. Reassign or remove them first.` },
      { status: 409 }
    )
  }

  const { error } = await supabase
    .from('room_categories')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
