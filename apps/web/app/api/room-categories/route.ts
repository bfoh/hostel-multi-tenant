import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

const schema = z.object({
  name:        z.string().min(2).max(100),
  type:        z.enum(['single', 'double', 'twin', 'triple', 'quad', 'dormitory', 'suite', 'studio']),
  base_rate:   z.number().int().min(1),
  rate_unit:   z.enum(['night', 'week', 'month', 'semester']),
  capacity:    z.number().int().min(1).max(20),
  description: z.string().max(500).nullable().optional(),
  amenities:   z.array(z.string()).default([]),
  is_active:   z.boolean().default(true),
})

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const tenantId = await getServerTenantId()
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('room_categories')
    .insert({ ...parsed.data, tenant_id: tenantId })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
