import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

const schema = z.object({
  room_number: z.string().min(1).max(20).optional(),
  category_id: z.string().uuid().optional(),
  floor:       z.number().int().min(0).max(100).nullable().optional(),
  block:       z.string().max(20).nullable().optional(),
  notes:       z.string().max(500).nullable().optional(),
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

  const supabase = createAdminClient()

  // Validate category_id (if provided) belongs to this tenant so a cross-tenant
  // id cannot be saved through the API.
  if (parsed.data.category_id) {
    const { data: category } = await supabase
      .from('room_categories')
      .select('id')
      .eq('id', parsed.data.category_id)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (!category) {
      return NextResponse.json({ error: 'Invalid room type for this tenant.' }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from('rooms')
    .update(parsed.data)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select('id')
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A room with this number already exists.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
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

  const supabase = createAdminClient()

  // Block delete if room has any bookings (FK is RESTRICT)
  const { count } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', id)

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Cannot delete: room has ${count} booking(s). Remove bookings first.` },
      { status: 409 }
    )
  }

  const { error } = await supabase
    .from('rooms')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    if (error.code === '23503') {
      const detail = (error as any).details ?? error.message ?? ''
      const matchedTable = detail.match(/on table "([^"]+)"/)?.[1]
      return NextResponse.json(
        {
          error: matchedTable
            ? `Cannot delete: room is still referenced by "${matchedTable}". Clear those records first or apply the latest migrations.`
            : 'Cannot delete: room is referenced by other records.',
          detail,
        },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
