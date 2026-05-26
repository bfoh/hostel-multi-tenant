import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { z } from 'zod'

const schema = z.object({
  key_label: z.string().min(1).max(50),
  key_type:  z.enum(['physical', 'card', 'fob']).default('physical'),
  notes:     z.string().max(300).optional(),
})

// GET /api/rooms/[id]/keys
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createTenantAdminClientFromHeaders()
  const { data, error } = await supabase
    .from('room_keys')
    .select('*, bookings(booking_ref), occupants(first_name, last_name)')
    .eq('room_id', id)
    .eq('tenant_id', tenantId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/rooms/[id]/keys — add a key
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 422 })

  const supabase = await createTenantAdminClientFromHeaders()
  const { data, error } = await (supabase.from('room_keys') as any)
    .insert({ tenant_id: tenantId, room_id: id, ...parsed.data, status: 'available' })
    .select('*, bookings(booking_ref), occupants(first_name, last_name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
