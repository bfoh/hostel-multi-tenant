import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId, getServerBusinessType } from '@/lib/auth/tenant'
import { createBooking } from '@/lib/bookings/create-booking'
import { sendEmail, groupBookingConfirmationHtml } from '@/lib/email'
import { formatGHS, formatDate } from '@/lib/utils'

const roomSchema = z.object({
  occupant_id:     z.string().uuid(),
  room_id:         z.string().uuid(),
  check_in_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source:          z.enum(['walk_in', 'phone', 'website', 'widget', 'voice_ai', 'referral']),
  discount_amount: z.number().int().min(0).default(0),
  discount_reason: z.string().max(200).optional().nullable(),
  notes:           z.string().max(500).optional().nullable(),
})

const schema = z.object({
  rooms:                 z.array(roomSchema).min(2).max(20),
  billing_contact_name:  z.string().max(120).optional().nullable(),
  billing_contact_email: z.string().email().optional().nullable(),
  billing_contact_phone: z.string().max(30).optional().nullable(),
})

function generateGroupRef(): string {
  const year = new Date().getFullYear()
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars
  let suffix = ''
  for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)]
  return `GRP-${year}-${suffix}`
}

/**
 * POST /api/bookings/group — hotel-only group booking.
 *
 * Creates one booking_groups row plus N bookings rows (one per room, via
 * the same createBooking() helper the single-booking route uses). Each
 * room keeps its own independent payments/discounts/invoice — this is
 * purely a linking record + billing contact for a combined invoice view.
 *
 * Rooms are created sequentially (not in parallel) so a mid-loop failure
 * can be rolled back cleanly — deletes every booking already created plus
 * the group row, rather than leaving a partial group behind.
 */
export async function POST(request: NextRequest) {
  if ((await getServerBusinessType()) !== 'hotel') {
    return NextResponse.json({ error: 'Group booking is not available for this account type' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const tenantId = await getServerTenantId()
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 401 })
  }

  const supabase = await createTenantAdminClientFromHeaders()
  const d = parsed.data

  const { data: group, error: groupErr } = await supabase
    .from('booking_groups')
    .insert({
      tenant_id:             tenantId,
      group_ref:             generateGroupRef(),
      billing_contact_name:  d.billing_contact_name ?? null,
      billing_contact_email: d.billing_contact_email ?? null,
      billing_contact_phone: d.billing_contact_phone ?? null,
      status:                'active',
    })
    .select('id, group_ref')
    .single()

  if (groupErr || !group) {
    return NextResponse.json({ error: groupErr?.message ?? 'Failed to create group' }, { status: 500 })
  }

  const created: { bookingId: string; bookingRef: string; roomNumber: string | null; occupantId: string; amount: number }[] = []

  for (const room of d.rooms) {
    const result = await createBooking(supabase, tenantId, { ...room, group_id: group.id })
    if (!result.ok) {
      // Roll back everything created so far plus the group row — no
      // partial groups left behind.
      for (const b of created) await supabase.from('bookings').delete().eq('id', b.bookingId)
      await supabase.from('booking_groups').delete().eq('id', group.id)
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    created.push({
      bookingId:  result.bookingId,
      bookingRef: result.bookingRef,
      roomNumber: result.roomNumber,
      occupantId: room.occupant_id,
      amount:     0, // filled in below once we can read total_amount back
    })
  }

  // One combined confirmation email to the billing contact, instead of one
  // per room — avoids spamming a group organizer.
  if (d.billing_contact_email) {
    try {
      const [{ data: tenant }, { data: bookingsWithAmounts }, { data: occupants }] = await Promise.all([
        supabase.from('tenants').select('name, primary_color, logo_url, contact_phone').eq('id', tenantId).single(),
        supabase.from('bookings').select('id, total_amount').in('id', created.map((c) => c.bookingId)),
        supabase.from('occupants').select('id, first_name, last_name').in('id', created.map((c) => c.occupantId)),
      ])

      const amountById = new Map((bookingsWithAmounts ?? []).map((b) => [b.id, b.total_amount as number]))
      const occupantById = new Map((occupants ?? []).map((o) => [o.id, `${o.first_name} ${o.last_name}`]))

      await sendEmail({
        to:      d.billing_contact_email,
        subject: `Group Booking Confirmation — ${group.group_ref}`,
        html:    groupBookingConfirmationHtml({
          hostelName:   tenant?.name ?? 'Your Property',
          primaryColor: tenant?.primary_color ?? '#1d4ed8',
          logoUrl:      tenant?.logo_url,
          contactName:  d.billing_contact_name ?? 'Guest',
          groupRef:     group.group_ref,
          checkInDate:  formatDate(d.rooms[0].check_in_date),
          checkOutDate: formatDate(d.rooms[0].check_out_date),
          contactPhone: tenant?.contact_phone ?? undefined,
          rooms: created.map((c) => ({
            roomName:  c.roomNumber ? `Room ${c.roomNumber}` : 'Room',
            guestName: occupantById.get(c.occupantId) ?? 'Guest',
            amountGHS: formatGHS(amountById.get(c.bookingId) ?? 0),
          })),
        }),
      })
    } catch {
      // Non-critical — the group and its bookings are already created.
    }
  }

  return NextResponse.json({
    id: group.id,
    group_ref: group.group_ref,
    bookings: created.map((c) => ({ id: c.bookingId, booking_ref: c.bookingRef })),
  }, { status: 201 })
}
