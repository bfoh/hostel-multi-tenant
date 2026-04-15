import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, bookingConfirmationHtml, checkoutSummaryHtml } from '@/lib/email'

const schema = z.object({
  status: z.enum(['confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show']),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id }    = await params
  const headersList = await headers()
  const tenantId  = headersList.get('x-tenant-id') ?? ''
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const nextStatus = parsed.data.status
  const supabase = await createClient()

  // Fetch current booking with guest + room + tenant context for emails
  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, status, room_id, check_in_date, check_out_date, final_amount, paid_amount,
      occupants(first_name, last_name, email),
      rooms(room_number, room_categories(name)),
      tenants(name, primary_color, contact_phone, slug)
    `)
    .eq('id', id)
    .single()

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  const updatePayload: {
    status: typeof nextStatus
    actual_check_in?: string
    actual_check_out?: string
    cancelled_at?: string
  } = { status: nextStatus }

  if (nextStatus === 'checked_in') {
    updatePayload.actual_check_in = new Date().toISOString()
  } else if (nextStatus === 'checked_out') {
    updatePayload.actual_check_out = new Date().toISOString()
  } else if (nextStatus === 'cancelled') {
    updatePayload.cancelled_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('bookings')
    .update(updatePayload)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Send transactional email (non-blocking)
  const occ    = Array.isArray(booking.occupants) ? booking.occupants[0] : booking.occupants
  const room   = Array.isArray(booking.rooms) ? booking.rooms[0] : booking.rooms
  const cat    = room ? (Array.isArray((room as any).room_categories) ? (room as any).room_categories[0] : (room as any).room_categories) : null
  const tenant = Array.isArray(booking.tenants) ? booking.tenants[0] : booking.tenants

  if (occ?.email && tenant) {
    const guestName    = `${occ.first_name} ${occ.last_name}`
    const hostelName   = tenant.name
    const primaryColor = tenant.primary_color ?? '#2563EB'
    const formatDate   = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GH', { dateStyle: 'long' })
    const formatGHS    = (p: number) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(p / 100)
    const bookingRef   = id.slice(0, 8).toUpperCase()

    if (nextStatus === 'confirmed') {
      sendEmail({
        to:         occ.email,
        senderName: hostelName,
        subject:    `Booking Confirmed — ${hostelName}`,
        html:    bookingConfirmationHtml({
          hostelName,
          primaryColor,
          guestName,
          bookingRef,
          roomName:     cat?.name ?? room?.room_number ?? 'Your room',
          checkInDate:  formatDate(booking.check_in_date),
          checkOutDate: booking.check_out_date ? formatDate(booking.check_out_date) : 'TBD',
          amountGHS:    formatGHS(booking.final_amount ?? 0),
          contactPhone: tenant.contact_phone ?? undefined,
        }),
      }).catch(() => {})
    }

    if (nextStatus === 'checked_out') {
      sendEmail({
        to:         occ.email,
        senderName: hostelName,
        subject:    `Thanks for staying — ${hostelName}`,
        html:    checkoutSummaryHtml({
          hostelName,
          primaryColor,
          guestName,
          bookingRef,
          roomName:     cat?.name ?? room?.room_number ?? 'Your room',
          checkOutDate: new Date().toLocaleDateString('en-GH', { dateStyle: 'long' }),
          totalPaid:    formatGHS(booking.paid_amount ?? 0),
        }),
      }).catch(() => {})
    }
  }

  // Sync room status based on remaining active bookings vs capacity
  if (booking.room_id) {
    const { data: roomData } = await supabase
      .from('rooms')
      .select('category:room_categories(capacity)')
      .eq('id', booking.room_id)
      .single()

    const cat = Array.isArray(roomData?.category) ? roomData?.category[0] : roomData?.category
    const capacity = cat?.capacity ?? 1

    // Count remaining active bookings (excluding the one just updated)
    const { count: remaining } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', booking.room_id)
      .neq('id', id)
      .in('status', ['pending_payment', 'confirmed', 'checked_in'])

    const activeRemaining = remaining ?? 0

    let roomStatus: 'available' | 'occupied' | 'reserved'
    if (nextStatus === 'checked_in') {
      // This booking is now checked in — checked_in counts as active
      const totalActive = activeRemaining + 1
      roomStatus = totalActive >= capacity ? 'occupied' : 'reserved'
    } else if (nextStatus === 'checked_out' || nextStatus === 'cancelled' || nextStatus === 'no_show') {
      roomStatus = activeRemaining === 0 ? 'available' : activeRemaining >= capacity ? 'occupied' : 'reserved'
    } else {
      roomStatus = activeRemaining >= capacity ? 'occupied' : 'reserved'
    }

    const roomUpdate: Record<string, unknown> = { status: roomStatus }
    if (nextStatus === 'checked_out') {
      roomUpdate.housekeeping_status = 'dirty'
    }
    await (supabase.from('rooms') as any).update(roomUpdate).eq('id', booking.room_id)

    // Auto-create housekeeping task on checkout
    if (nextStatus === 'checked_out') {
      // Find next confirmed/pending booking for this room to set due_by + priority
      const { data: nextBooking } = await supabase
        .from('bookings')
        .select('check_in_date')
        .eq('room_id', booking.room_id)
        .in('status', ['confirmed', 'pending_payment'])
        .gt('check_in_date', new Date().toISOString().split('T')[0])
        .order('check_in_date')
        .limit(1)
        .single()

      const dueBy     = nextBooking?.check_in_date ?? null
      const daysUntil = dueBy
        ? Math.ceil((new Date(dueBy).getTime() - Date.now()) / 86400000)
        : null
      const priority  = daysUntil === null ? 'normal'
        : daysUntil <= 0 ? 'urgent'
        : daysUntil === 1 ? 'high'
        : 'normal'

      // Find a housekeeper (staff in housekeeping department)
      const { data: housekeeper } = await supabase
        .from('staff_profiles')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .ilike('department', '%house%')
        .limit(1)
        .maybeSingle()

      if (tenantId) {
        await supabase.from('housekeeping_tasks').insert({
          tenant_id:   tenantId,
          room_id:     booking.room_id,
          booking_id:  id,
          assigned_to: housekeeper?.id ?? null,
          status:      'pending',
          priority,
          due_by:      dueBy,
          source:      'checkout',
        })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
