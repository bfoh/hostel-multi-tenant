import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

const schema = z.object({
  room_number: z.string().min(1).max(20),
  category_id: z.string().uuid(),
  floor:       z.number().int().min(0).max(100).nullable().optional(),
  block:       z.string().max(20).nullable().optional(),
  notes:       z.string().max(500).nullable().optional(),
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

  // Use admin client so RLS on rooms (which has no INSERT policy for the
  // session-bound client) doesn't reject the row. Middleware has already
  // proven tenant ownership via x-tenant-id.
  const supabase = createAdminClient()

  // Verify the chosen category belongs to this tenant so the picker can't
  // be used to attach a room to another tenant's category.
  const { data: category } = await supabase
    .from('room_categories')
    .select('id')
    .eq('id', parsed.data.category_id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!category) {
    return NextResponse.json({ error: 'Invalid room type for this tenant.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('rooms')
    .insert({
      tenant_id:   tenantId,
      room_number: parsed.data.room_number,
      category_id: parsed.data.category_id,
      floor:       parsed.data.floor ?? null,
      block:       parsed.data.block ?? null,
      notes:       parsed.data.notes ?? null,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A room with this number already exists.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
