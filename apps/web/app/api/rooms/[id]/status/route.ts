import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

// Manual overrides only. 'occupied' and 'reserved' are derived from
// active bookings vs category capacity (room_occupancy_v) and must not
// be set by hand — that would lie about bed availability for
// multi-occupancy rooms (2/3/4-in-a-room).
const schema = z.object({
  status: z.enum(['available', 'maintenance', 'blocked']),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('rooms')
    .update({ status: parsed.data.status })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select('id')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Room not found' }, { status: error ? 500 : 404 })
  }

  return NextResponse.json({ ok: true })
}
