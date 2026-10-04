import type { SupabaseClient } from '@supabase/supabase-js'
import type { PaymentMethod } from '@/lib/payments/methods'
import { sendBookingConfirmation, sendAdminBookingAlert } from '@/lib/sms'
import { sendEmail, bookingConfirmationHtml, adminAlertHtml } from '@/lib/email'
import { getTenantAdminContacts } from '@/lib/notifications/admin-recipients'
import { formatGHS } from '@/lib/utils'

/**
 * Shared single-room booking creation, used by both the plain single
 * booking route (api/bookings/route.ts) and the group-booking route
 * (api/bookings/group/route.ts, which calls this once per room). Extracted
 * so room-capacity/rate/booking-ref logic lives in exactly one place —
 * duplicating booking-creation logic across two routes is exactly the kind
 * of drift risk that's bitten this codebase before.
 */

export interface CreateBookingParams {
  occupant_id:     string
  room_id:         string
  check_in_date:   string
  check_out_date:  string
  source:          'walk_in' | 'phone' | 'website' | 'widget' | 'voice_ai' | 'referral'
  semester?:       string | null
  academic_year?:  string | null
  discount_amount?: number
  discount_reason?: string | null
  notes?:          string | null
  group_id?:       string | null
  /** Optional payment(s) collected at booking time — see PaymentSplitInput.
   *  Amounts are in pesewas. Omitted/empty behaves exactly as before
   *  (booking created with no payment, status 'pending_payment'). */
  payments?:       { method: PaymentMethod; amount: number }[]
  /** Required when `payments` is non-empty — the staff member who
   *  collected it, stamped on each booking_payments row. */
  receivedBy?:     string
}

export type CreateBookingResult =
  | { ok: true; bookingId: string; bookingRef: string; roomNumber: string | null; status: string }
  | { ok: false; status: number; error: string }

function generateBookingRef(): string {
  const year = new Date().getFullYear()
  const rand = Math.floor(Math.random() * 900000) + 100000
  return `ABR-${year}-${rand}`
}

export async function createBooking(
  supabase: SupabaseClient<any>,
  tenantId: string,
  params: CreateBookingParams,
): Promise<CreateBookingResult> {
  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .select('id, room_number, status, category:room_categories(base_rate, rate_unit, capacity)')
    .eq('id', params.room_id)
    .single()

  if (roomErr || !room) {
    return { ok: false, status: 404, error: 'Room not found.' }
  }

  if (room.status === 'maintenance' || room.status === 'blocked') {
    return { ok: false, status: 409, error: 'Room is not available for booking.' }
  }

  const category = Array.isArray(room.category) ? room.category[0] : room.category
  const baseRate = category?.base_rate ?? 0
  const categoryCapacity = category?.capacity ?? 1
  const finalAmount = Math.max(0, baseRate - (params.discount_amount ?? 0))
  const collectedAtBooking = (params.payments ?? []).reduce((sum, payment) => sum + payment.amount, 0)

  if (collectedAtBooking > finalAmount) {
    return {
      ok: false,
      status: 422,
      error: `Payments cannot exceed the booking total (${formatGHS(finalAmount)}).`,
    }
  }

  // A hotel room is sold as one unit per stay regardless of how many guests
  // its category says it sleeps — mirrors the DB trigger in migration 130.
  // Only hostel dorm-style rooms (capacity = number of independently-
  // bookable beds) allow concurrent bookings against the same room.
  const { data: tenantRow } = await supabase.from('tenants').select('business_type').eq('id', tenantId).single()
  const capacity = tenantRow?.business_type === 'hotel' ? 1 : categoryCapacity

  const { count: activeCount } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', params.room_id)
    .lte('check_in_date', params.check_out_date)
    .gte('check_out_date', params.check_in_date)
    .in('status', ['pending_payment', 'confirmed', 'checked_in'])

  if ((activeCount ?? 0) >= capacity) {
    return { ok: false, status: 409, error: `Room ${room.room_number} is fully booked for those dates.` }
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      tenant_id:       tenantId,
      booking_ref:     generateBookingRef(),
      occupant_id:     params.occupant_id,
      room_id:         params.room_id,
      check_in_date:   params.check_in_date,
      check_out_date:  params.check_out_date,
      source:          params.source,
      semester:        params.semester ?? null,
      academic_year:   params.academic_year ?? null,
      rate_per_unit:   baseRate,
      rate_unit:       category?.rate_unit ?? 'semester',
      total_amount:    baseRate,
      discount_amount: params.discount_amount ?? 0,
      discount_reason: params.discount_reason ?? null,
      tax_amount:      0,
      notes:           params.notes ?? null,
      status:          'pending_payment',
      group_id:        params.group_id ?? null,
    })
    .select('id, booking_ref')
    .single()

  if (error) {
    if (error.code === '23P01') {
      return { ok: false, status: 409, error: `Room ${room.room_number} is already booked for those dates.` }
    }
    return { ok: false, status: 500, error: error.message }
  }

  const newCount = (activeCount ?? 0) + 1
  const newRoomStatus = newCount >= capacity ? 'occupied' : 'reserved'
  await supabase.from('rooms').update({ status: newRoomStatus }).eq('id', params.room_id)

  let status = 'pending_payment'

  if (params.payments && params.payments.length > 0) {
    const { error: paymentsErr } = await supabase.from('booking_payments').insert(
      params.payments.map((p) => ({
        tenant_id:   tenantId,
        booking_id:  data.id,
        amount:      p.amount,
        method:      p.method,
        status:      'success',
        paid_at:     new Date().toISOString(),
        received_by: params.receivedBy ?? null,
      })),
    )

    // Best-effort — the booking itself already exists at this point; a
    // payment-insert failure shouldn't roll it back, just leave it
    // pending_payment so staff can record the payment again via the
    // regular "Record Payment" flow.
    if (!paymentsErr) {
      const paidAmount = params.payments.reduce((s, p) => s + p.amount, 0)
      if (paidAmount >= finalAmount) {
        status = 'confirmed'
        await supabase.from('bookings').update({ status }).eq('id', data.id)
      }
    }
  }

  // Guest confirmation + owner/admin alert (non-blocking) — this path
  // (staff-created + group bookings) previously sent no notification at all.
  notifyBookingCreated(supabase, {
    tenantId,
    bookingId:    data.id,
    bookingRef:   data.booking_ref,
    roomNumber:   room.room_number ?? '',
    checkInDate:  params.check_in_date,
    checkOutDate: params.check_out_date,
    amount:       Math.max(0, baseRate - (params.discount_amount ?? 0)),
    occupantId:   params.occupant_id,
    status,
  }).catch(() => {})

  return { ok: true, bookingId: data.id, bookingRef: data.booking_ref, roomNumber: room.room_number ?? null, status }
}

async function notifyBookingCreated(
  supabase: SupabaseClient<any>,
  params: {
    tenantId:     string
    bookingId:    string
    bookingRef:   string
    roomNumber:   string
    checkInDate:  string
    checkOutDate: string
    amount:       number
    occupantId:   string
    status:       string
  },
): Promise<void> {
  const [occupantRes, tenantRes, admins] = await Promise.all([
    supabase.from('occupants').select('first_name, last_name, phone, email').eq('id', params.occupantId).single(),
    supabase.from('tenants').select('name, primary_color, logo_url, contact_phone').eq('id', params.tenantId).single(),
    getTenantAdminContacts(supabase, params.tenantId),
  ])

  const occ = occupantRes.data
  const ten = tenantRes.data
  if (!ten) return

  const guestName  = occ ? `${occ.first_name} ${occ.last_name}` : 'Guest'
  const amountGHS  = formatGHS(params.amount)
  const checkInFmt = new Date(params.checkInDate + 'T00:00:00').toLocaleDateString('en-GH', { dateStyle: 'long' })

  if (admins.smsEnabled && occ?.phone) {
    sendBookingConfirmation({
      phone:       occ.phone,
      firstName:   occ.first_name,
      bookingRef:  params.bookingRef,
      roomNumber:  params.roomNumber,
      checkInDate: checkInFmt,
      hostelName:  ten.name,
      tenantId:    params.tenantId,
      amount:      amountGHS,
    }).catch(() => {})
  }

  if (admins.emailEnabled && occ?.email) {
    const checkOutFmt = new Date(params.checkOutDate + 'T00:00:00').toLocaleDateString('en-GH', { dateStyle: 'long' })
    sendEmail({
      to:         occ.email,
      senderName: ten.name,
      subject:    `Booking ${params.status === 'confirmed' ? 'confirmed' : 'received'} — ${ten.name}`,
      html:    bookingConfirmationHtml({
        hostelName:   ten.name,
        primaryColor: ten.primary_color ?? '#2563EB',
        logoUrl:      (ten as any).logo_url ?? null,
        guestName,
        bookingRef:   params.bookingRef,
        roomName:     params.roomNumber ? `Room ${params.roomNumber}` : 'Your room',
        checkInDate:  checkInFmt,
        checkOutDate: checkOutFmt,
        amountGHS,
        contactPhone: ten.contact_phone ?? undefined,
      }),
    }).catch(() => {})
  }

  const eventLine = `New booking for ${guestName} — Room ${params.roomNumber}, ${checkInFmt} (${params.bookingRef})`

  if (admins.smsEnabled) {
    for (const phone of admins.phones) {
      sendAdminBookingAlert({ phone, hostelName: ten.name, eventLine, tenantId: params.tenantId }).catch(() => {})
    }
  }
  if (admins.emailEnabled) {
    for (const email of admins.emails) {
      sendEmail({
        to:         email,
        senderName: ten.name,
        subject:    `New booking — ${params.bookingRef}`,
        html:    adminAlertHtml({
          hostelName:   ten.name,
          primaryColor: ten.primary_color ?? '#2563EB',
          logoUrl:      (ten as any).logo_url ?? null,
          title:        'New booking',
          lines: [
            { label: 'Guest',    value: guestName },
            { label: 'Room',     value: params.roomNumber },
            { label: 'Check-in', value: checkInFmt },
            { label: 'Amount',   value: amountGHS },
            { label: 'Booking',  value: params.bookingRef },
          ],
        }),
      }).catch(() => {})
    }
  }
}
