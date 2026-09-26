import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId, getServerBusinessType } from '@/lib/auth/tenant'
import { createBooking } from '@/lib/bookings/create-booking'

const addSchema = z.object({
  occupant_id:     z.string().uuid(),
  room_id:         z.string().uuid(),
  check_in_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source:          z.enum(['walk_in', 'phone', 'website', 'widget', 'voice_ai', 'referral']),
  discount_amount: z.number().int().min(0).default(0),
  discount_reason: z.string().max(200).optional().nullable(),
  notes:           z.string().max(500).optional().nullable(),
})

// POST /api/bookings/group/[id]/members — add a room to an existing group
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if ((await getServerBusinessType()) !== 'hotel') {
    return NextResponse.json({ error: 'Not available for this account type' }, { status: 403 })
  }

  const { id } = await params
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const supabase = await createTenantAdminClientFromHeaders()

  const { data: group } = await supabase
    .from('booking_groups')
    .select('id, status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  if (group.status !== 'active') return NextResponse.json({ error: 'This group has been cancelled' }, { status: 409 })

  const body = await req.json().catch(() => null)
  const parsed = addSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })

  const result = await createBooking(supabase, tenantId, { ...parsed.data, group_id: group.id })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  return NextResponse.json({ id: result.bookingId, booking_ref: result.bookingRef }, { status: 201 })
}

const removeSchema = z.object({ booking_id: z.string().uuid() })

// DELETE /api/bookings/group/[id]/members — remove one room from a group
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if ((await getServerBusinessType()) !== 'hotel') {
    return NextResponse.json({ error: 'Not available for this account type' }, { status: 403 })
  }

  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = removeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'A valid booking_id is required' }, { status: 422 })

  const supabase = await createTenantAdminClientFromHeaders()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, group_id')
    .eq('id', parsed.data.booking_id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!booking || booking.group_id !== id) {
    return NextResponse.json({ error: 'Booking not found in this group' }, { status: 404 })
  }
  if (booking.status === 'checked_in') {
    return NextResponse.json({ error: 'Cannot remove: this guest is checked in' }, { status: 409 })
  }

  await supabase
    .from('bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancellation_reason: 'Removed from group' })
    .eq('id', booking.id)

  // If this was the last active member, close the group too.
  const { data: remaining } = await supabase
    .from('bookings')
    .select('id, status')
    .eq('group_id', id)
    .neq('id', booking.id)

  const stillActive = (remaining ?? []).some((m) => !['checked_out', 'cancelled'].includes(m.status))
  if (!stillActive) {
    await supabase.from('booking_groups').update({ status: 'cancelled' }).eq('id', id)
  }

  return NextResponse.json({ ok: true, groupClosed: !stillActive })
}
