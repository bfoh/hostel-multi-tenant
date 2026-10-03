import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerBusinessType } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { cancelBooking } from '@/lib/bookings/cancel-booking'

const GROUP_MANAGE_ROLES = ['owner', 'manager'] as const

// GET /api/bookings/group/[id] — group + member bookings
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if ((await getServerBusinessType()) !== 'hotel') {
    return NextResponse.json({ error: 'Not available for this account type' }, { status: 403 })
  }

  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createTenantAdminClientFromHeaders()

  const { data: group } = await supabase
    .from('booking_groups')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

  const { data: bookings } = await supabase
    .from('bookings')
    .select(
      `
      id, booking_ref, status, check_in_date, check_out_date, total_amount, final_amount, paid_amount,
      occupant:occupants(id, first_name, last_name, phone, email),
      room:rooms(id, room_number, block)
    `
    )
    .eq('group_id', id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ group, bookings: bookings ?? [] })
}

const patchSchema = z.object({
  billing_contact_name: z.string().max(120).nullable().optional(),
  billing_contact_email: z.string().email().nullable().optional(),
  billing_contact_phone: z.string().max(30).nullable().optional(),
})

// PATCH /api/bookings/group/[id] — edit billing contact
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if ((await getServerBusinessType()) !== 'hotel') {
    return NextResponse.json({ error: 'Not available for this account type' }, { status: 403 })
  }

  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })

  const supabase = await createTenantAdminClientFromHeaders()
  const { data, error } = await supabase
    .from('booking_groups')
    .update(parsed.data)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/bookings/group/[id] — cancel the whole group
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if ((await getServerBusinessType()) !== 'hotel') {
    return NextResponse.json({ error: 'Not available for this account type' }, { status: 403 })
  }

  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await requireTenantRole(tenantId, GROUP_MANAGE_ROLES)
  if (role instanceof NextResponse) return role

  const supabase = await createTenantAdminClientFromHeaders()

  const { data: group } = await supabase
    .from('booking_groups')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

  const { data: members } = await supabase.from('bookings').select('id, status').eq('group_id', id)

  if ((members ?? []).some((m) => m.status === 'checked_in')) {
    return NextResponse.json(
      { error: 'Cannot cancel: at least one guest in this group is checked in' },
      { status: 409 }
    )
  }

  const cancellable = (members ?? []).filter((m) =>
    ['enquiry', 'pending_confirmation', 'pending_payment', 'confirmed'].includes(m.status)
  )
  const cancellations = await Promise.allSettled(
    cancellable.map((member) =>
      cancelBooking(supabase, {
        tenantId,
        bookingId: member.id,
        reason: 'Group cancelled',
        source: 'group',
        actorId: role.userId,
        expectedStatus: member.status,
      })
    )
  )

  const failed = cancellations.filter((result) => result.status === 'rejected')
  if (failed.length > 0) {
    return NextResponse.json(
      {
        error: `Could not cancel ${failed.length} group booking(s). The group remains active.`,
        cancelled: cancellations.length - failed.length,
      },
      { status: 409 }
    )
  }

  const { error } = await supabase
    .from('booking_groups')
    .update({ status: 'cancelled' })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
