import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { requireTenantRole } from '@/lib/auth/tenant-role'
import { getServerTenantId } from '@/lib/auth/tenant'
import { cancelBooking } from '@/lib/bookings/cancel-booking'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

const schema = z.object({
  reason: z.string().trim().min(3, 'Please provide a cancellation reason').max(500),
  expectedStatus: z
    .enum(['enquiry', 'pending_confirmation', 'pending_payment', 'confirmed'])
    .optional(),
})

const CANCELLATION_ROLES = ['owner', 'manager'] as const

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const role = await requireTenantRole(tenantId, CANCELLATION_ROLES)
  if (role instanceof NextResponse) return role

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 422 }
    )
  }

  const { id } = await params
  const supabase = await createTenantAdminClientFromHeaders()

  try {
    const result = await cancelBooking(supabase, {
      tenantId,
      bookingId: id,
      reason: parsed.data.reason,
      source: 'staff',
      actorId: role.userId,
      expectedStatus: parsed.data.expectedStatus,
    })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cancellation failed'
    const status = message.includes('not found')
      ? 404
      : message.includes('cannot be cancelled') || message.includes('status changed')
        ? 409
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}
