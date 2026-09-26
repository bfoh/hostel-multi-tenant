import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerBusinessType } from '@/lib/auth/tenant'
import { getAvailableRooms } from '@/lib/data/bookings'
import { sendStayExtension } from '@/lib/sms'
import { sendEmail, stayExtensionHtml } from '@/lib/email'
import { formatGHS, formatDate } from '@/lib/utils'

/**
 * POST /api/bookings/[id]/extend-stay — hotel-only.
 *
 * A separate route from the shared /api/bookings/[id]/renew (used by both
 * verticals) rather than modifying it — this adds an availability
 * pre-check with alternative-room suggestions (AMP Lodge's UX for this),
 * which /renew doesn't have, but /renew is a hostel-shared file this
 * change must not touch.
 *
 * If the current room isn't free for the extension window, responds 409
 * with alternative rooms instead of letting the DB's no-overlap exclusion
 * constraint reject the write with a raw error. Passing new_room_id moves
 * the whole booking to that room going forward (not just the extension
 * nights — no split-stay/room-per-date-range modeling, matching the
 * simplest version of this feature).
 */

const schema = z.object({
  new_check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  new_room_id:         z.string().uuid().optional(),
})

export async function POST(
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
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 422 })

  const supabase = await createTenantAdminClientFromHeaders()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, room_id, occupant_id, booking_ref, check_in_date, check_out_date, rate_per_unit, rate_unit, total_amount')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  if (!['confirmed', 'checked_in'].includes(booking.status)) {
    return NextResponse.json({ error: 'Only confirmed or checked-in stays can be extended' }, { status: 400 })
  }

  const newCheckOut = parsed.data.new_check_out_date
  if (newCheckOut <= booking.check_out_date) {
    return NextResponse.json({ error: 'New check-out date must be after the current check-out date' }, { status: 400 })
  }

  const targetRoomId = parsed.data.new_room_id ?? booking.room_id

  // Availability pre-check over the extension window only (old checkout →
  // new checkout) — matches the DB exclusion constraint's own status
  // filter (confirmed/checked_in) so this doesn't flag conflicts the
  // constraint itself wouldn't actually block.
  const { data: conflicts } = await supabase
    .from('bookings')
    .select('id')
    .eq('room_id', targetRoomId)
    .neq('id', id)
    .lt('check_in_date', newCheckOut)
    .gt('check_out_date', booking.check_out_date)
    .in('status', ['confirmed', 'checked_in'])

  if ((conflicts ?? []).length > 0) {
    const alternativeRooms = (await getAvailableRooms(booking.check_out_date, newCheckOut))
      .filter((r) => r.id !== targetRoomId)

    return NextResponse.json({
      error: 'This room is not available for the extended dates.',
      alternativeRooms,
    }, { status: 409 })
  }

  const oldOut = new Date(booking.check_out_date)
  const newOut = new Date(newCheckOut)
  const extraNights = Math.round((newOut.getTime() - oldOut.getTime()) / 86400000)
  const extraAmount = booking.rate_unit === 'night' ? booking.rate_per_unit * extraNights : 0
  const newTotal = booking.total_amount + extraAmount

  const { data: updated, error } = await supabase
    .from('bookings')
    .update({
      check_out_date: newCheckOut,
      total_amount:   newTotal,
      ...(parsed.data.new_room_id && parsed.data.new_room_id !== booking.room_id
        ? { room_id: parsed.data.new_room_id }
        : {}),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    if (error.code === '23P01') {
      return NextResponse.json({ error: 'This room was just booked for those dates by someone else.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Guest-facing notification, non-blocking — must never break the
  // extension itself if it fails.
  try {
    const [{ data: occupant }, { data: room }, { data: tenant }] = await Promise.all([
      supabase.from('occupants').select('first_name, phone, email').eq('id', booking.occupant_id).single(),
      supabase.from('rooms').select('room_number').eq('id', updated.room_id).single(),
      supabase.from('tenants').select('name, primary_color, logo_url').eq('id', tenantId).single(),
    ])

    if (occupant?.phone) {
      sendStayExtension({
        phone:        occupant.phone,
        firstName:    occupant.first_name,
        bookingRef:   booking.booking_ref,
        checkOutDate: formatDate(newCheckOut),
        hostelName:   tenant?.name ?? 'Your Property',
        amount:       formatGHS(extraAmount),
        tenantId,
      }).catch(() => {})
    }

    if (occupant?.email) {
      sendEmail({
        to:      occupant.email,
        subject: `Your stay has been extended — ${tenant?.name ?? 'Your Property'}`,
        html:    stayExtensionHtml({
          hostelName:   tenant?.name ?? 'Your Property',
          primaryColor: tenant?.primary_color ?? '#1d4ed8',
          logoUrl:      tenant?.logo_url,
          guestName:    occupant.first_name,
          bookingRef:   booking.booking_ref,
          roomName:     room?.room_number ? `Room ${room.room_number}` : 'Room',
          checkOutDate: formatDate(newCheckOut),
          amountGHS:    formatGHS(extraAmount),
        }),
      }).catch(() => {})
    }
  } catch { /* non-critical */ }

  return NextResponse.json({ booking: updated, extraNights, extraAmount })
}
