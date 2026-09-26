import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerBusinessType } from '@/lib/auth/tenant'

// GET /api/bookings/group/[id] — group + member bookings
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    .select(`
      id, booking_ref, status, check_in_date, check_out_date, total_amount, final_amount, paid_amount,
      occupant:occupants(id, first_name, last_name, phone, email),
      room:rooms(id, room_number, block)
    `)
    .eq('group_id', id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ group, bookings: bookings ?? [] })
}

const patchSchema = z.object({
  billing_contact_name:  z.string().max(120).nullable().optional(),
  billing_contact_email: z.string().email().nullable().optional(),
  billing_contact_phone: z.string().max(30).nullable().optional(),
})

// PATCH /api/bookings/group/[id] — edit billing contact
export async function PATCH(
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
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })

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
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    .select('id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

  const { data: members } = await supabase
    .from('bookings')
    .select('id, status')
    .eq('group_id', id)

  if ((members ?? []).some((m) => m.status === 'checked_in')) {
    return NextResponse.json({ error: 'Cannot cancel: at least one guest in this group is checked in' }, { status: 409 })
  }

  const cancellable = (members ?? []).filter((m) => !['checked_out', 'cancelled'].includes(m.status))
  if (cancellable.length > 0) {
    await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancellation_reason: 'Group cancelled' })
      .in('id', cancellable.map((m) => m.id))
  }

  const { error } = await supabase
    .from('booking_groups')
    .update({ status: 'cancelled' })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
