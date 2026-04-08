import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
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

  const supabase = await createClient()
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
