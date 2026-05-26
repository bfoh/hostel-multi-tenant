import { NextResponse, type NextRequest } from 'next/server'
import { getServerTenantId } from '@/lib/auth/tenant'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

interface BulkDeleteBody {
  ids: string[]
}

/**
 * POST /api/rooms/bulk-delete
 *
 * Deletes multiple rooms in one call. Each room is checked individually:
 * a room with any booking is skipped (FK is RESTRICT on bookings) and
 * reported back in `blocked`, the rest are deleted. Non-booking FKs were
 * relaxed to ON DELETE SET NULL in migration 091, so maintenance/asset
 * history survives.
 */
export async function POST(req: NextRequest) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  let body: BulkDeleteBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 })
  }
  if (body.ids.length > 200) {
    return NextResponse.json({ error: 'Maximum 200 rooms per bulk delete' }, { status: 400 })
  }

  const supabase = await createTenantAdminClientFromHeaders()

  // Find rooms in this batch that have bookings — those are blocked.
  const { data: bookedRows } = await (supabase as any)
    .from('bookings')
    .select('room_id')
    .eq('tenant_id', tenantId)
    .in('room_id', body.ids)

  const bookedRoomIds = new Set(((bookedRows ?? []) as any[]).map((r) => r.room_id as string))
  const deletable = body.ids.filter((id) => !bookedRoomIds.has(id))

  const blocked = Array.from(bookedRoomIds).map((id) => ({
    id,
    reason: 'Has bookings — remove bookings first',
  }))

  let deleted: string[] = []
  if (deletable.length > 0) {
    const { data, error } = await (supabase as any)
      .from('rooms')
      .delete()
      .eq('tenant_id', tenantId)
      .in('id', deletable)
      .select('id')

    if (error) {
      // FK violation on a non-booking table that wasn't relaxed — report it.
      if (error.code === '23503') {
        return NextResponse.json({
          error: 'Some rooms are still referenced by other records. Apply the latest migrations and retry.',
          detail: (error as any).details ?? error.message,
        }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    deleted = ((data ?? []) as any[]).map((r) => r.id as string)
  }

  return NextResponse.json({
    ok: true,
    deleted:      deleted.length,
    blocked:      blocked.length,
    blockedRooms: blocked,
  })
}
