import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { z } from 'zod'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { reassignBookingRoom } from '@/lib/bookings/reassign-booking-room'

const schema = z.object({
  room_id: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
  expected_room_id: z.string().uuid().optional(),
  expected_status: z
    .enum(['pending_confirmation', 'pending_payment', 'confirmed', 'checked_in'])
    .optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Validate session and role
  const roleCtx = await requireTenantRole(tenantId, ['owner', 'manager', 'receptionist'])
  if (roleCtx instanceof NextResponse) {
    return roleCtx
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 422 })
  }

  const supabase = await createTenantAdminClientFromHeaders()

  try {
    const result = await reassignBookingRoom(supabase, {
      tenantId,
      bookingId: id,
      newRoomId: parsed.data.room_id,
      reason: parsed.data.reason,
      actorId: roleCtx.userId,
      expectedRoomId: parsed.data.expected_room_id,
      expectedStatus: parsed.data.expected_status,
    })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Room reassignment failed'
    const status = message.includes('not found')
      ? 404
      : message.includes('capacity') ||
          message.includes('not available') ||
          message.includes('cannot be reassigned') ||
          message.includes('changed')
        ? 409
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}
