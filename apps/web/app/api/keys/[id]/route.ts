import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { z } from 'zod'

const issueSchema = z.object({
  action:      z.enum(['issue', 'return', 'mark_lost', 'mark_damaged', 'retire']),
  booking_id:  z.string().uuid().optional(),
  occupant_id: z.string().uuid().optional(),
  notes:       z.string().max(300).optional(),
})

// PATCH /api/keys/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createTenantAdminClientFromHeaders()

  const { data: key } = await supabase
    .from('room_keys')
    .select('id, status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!key) return NextResponse.json({ error: 'Key not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = issueSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 422 })

  const { action, booking_id, occupant_id, notes } = parsed.data
  const update: Record<string, unknown> = { notes }

  switch (action) {
    case 'issue':
      if (key.status !== 'available') return NextResponse.json({ error: 'Key is not available' }, { status: 400 })
      Object.assign(update, { status: 'issued', issued_at: new Date().toISOString(), returned_at: null, booking_id, occupant_id })
      break
    case 'return':
      if (key.status !== 'issued') return NextResponse.json({ error: 'Key is not currently issued' }, { status: 400 })
      Object.assign(update, { status: 'available', returned_at: new Date().toISOString(), booking_id: null, occupant_id: null })
      break
    case 'mark_lost':
      Object.assign(update, { status: 'lost', returned_at: null })
      break
    case 'mark_damaged':
      Object.assign(update, { status: 'damaged' })
      break
    case 'retire':
      Object.assign(update, { status: 'retired' })
      break
  }

  const { data, error } = await (supabase.from('room_keys') as any)
    .update(update)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select('*, bookings(booking_ref), occupants(first_name, last_name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/keys/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createTenantAdminClientFromHeaders()
  const { error } = await supabase
    .from('room_keys')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
