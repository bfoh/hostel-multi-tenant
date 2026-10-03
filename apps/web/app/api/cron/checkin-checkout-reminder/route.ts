/**
 * GET/POST /api/cron/checkin-checkout-reminder
 *
 * Fixed daily sweep (07:00 UTC = 07:00 Accra, no DST) that prompts staff —
 * and reminds the guest — about arrivals and departures due today or
 * already overdue, closing the gap where a guest's check-in/check-out date
 * arrives and nobody gets nudged. Deliberately a reminder, not an automatic
 * status change — a human should always confirm a guest actually arrived
 * or left before the system marks it so.
 *
 * Idempotency: tenants.checkin_reminder_last_sent_date, same per-tenant
 * timestamp-column pattern as app/api/cron/trial-expiry's warning columns.
 *
 * Auth: same CRON_SECRET convention as every other cron route in this app.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, adminAlertHtml } from '@/lib/email'
import { sendAdminBookingAlert, sendCheckInReminder, sendCheckoutReminder } from '@/lib/sms'
import { getTenantAdminContacts } from '@/lib/notifications/admin-recipients'
import { classifyDueBookings, type DueBooking } from '@/lib/bookings/classify-due-bookings'

export async function POST(req: NextRequest) {
  return handle(req)
}
export async function GET(req: NextRequest) {
  return handle(req)
}

async function handle(req: NextRequest) {
  const secret =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    req.nextUrl.searchParams.get('secret')

  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const force = req.nextUrl.searchParams.get('force') === '1'
  const onlyTenantId = req.nextUrl.searchParams.get('tenant_id')

  const admin = createAdminClient() as any
  const today = new Date().toISOString().slice(0, 10)

  let query = admin
    .from('tenants')
    .select('id, name, primary_color, logo_url, checkin_reminder_last_sent_date')
    .in('status', ['active', 'trial'])

  if (onlyTenantId) query = query.eq('id', onlyTenantId)
  const { data: tenants } = await query

  const results: any[] = []

  for (const tenant of (tenants ?? []) as any[]) {
    if (!force && tenant.checkin_reminder_last_sent_date === today) {
      results.push({ tenant_id: tenant.id, skipped: true, reason: 'already sent today' })
      continue
    }

    try {
      const [arrivalsRes, departuresRes] = await Promise.all([
        admin
          .from('bookings')
          .select(
            'id, booking_ref, check_in_date, occupant:occupants(first_name,last_name,phone), room:rooms(room_number,block)'
          )
          .eq('tenant_id', tenant.id)
          .lte('check_in_date', today)
          .eq('status', 'confirmed')
          .order('check_in_date'),
        admin
          .from('bookings')
          .select(
            'id, booking_ref, check_out_date, occupant:occupants(first_name,last_name,phone), room:rooms(room_number,block)'
          )
          .eq('tenant_id', tenant.id)
          .lte('check_out_date', today)
          .eq('status', 'checked_in')
          .order('check_out_date'),
      ])

      const arrivals = (arrivalsRes.data ?? []) as DueBooking[]
      const departures = (departuresRes.data ?? []) as DueBooking[]

      if (arrivals.length === 0 && departures.length === 0) {
        results.push({ tenant_id: tenant.id, skipped: true, reason: 'nothing due' })
      } else {
        await notifyTenant(admin, tenant, today, arrivals, departures)
        results.push({
          tenant_id: tenant.id,
          arrivals: arrivals.length,
          departures: departures.length,
        })
      }

      await admin
        .from('tenants')
        .update({ checkin_reminder_last_sent_date: today })
        .eq('id', tenant.id)
    } catch (err: any) {
      results.push({ tenant_id: tenant.id, error: err?.message ?? String(err) })
    }
  }

  return NextResponse.json({ ok: true, total: results.length, results })
}

function roomLabel(room: DueBooking['room']): string {
  if (!room) return 'unassigned room'
  return room.block ? `${room.block} · ${room.room_number}` : room.room_number
}

function guestName(occ: DueBooking['occupant']): string {
  return occ ? `${occ.first_name} ${occ.last_name}` : 'Guest'
}

async function notifyTenant(
  admin: any,
  tenant: { id: string; name: string; primary_color: string | null; logo_url: string | null },
  today: string,
  arrivals: DueBooking[],
  departures: DueBooking[]
) {
  const { todayArrivals, overdueArrivals, todayDepartures, overdueDepartures } =
    classifyDueBookings(arrivals, departures, today)

  // ── Guest-side reminders — wires up sendCheckInReminder/sendCheckoutReminder,
  // written long ago but never called from anywhere until now.
  for (const b of todayArrivals) {
    if (b.occupant?.phone) {
      sendCheckInReminder({
        phone: b.occupant.phone,
        firstName: b.occupant.first_name,
        checkInDate: b.check_in_date!,
        roomNumber: roomLabel(b.room),
        hostelName: tenant.name,
        tenantId: tenant.id,
      }).catch(() => {})
    }
  }
  for (const b of [...todayDepartures, ...overdueDepartures]) {
    if (b.occupant?.phone) {
      sendCheckoutReminder({
        phone: b.occupant.phone,
        firstName: b.occupant.first_name,
        checkOutDate: b.check_out_date!,
        bookingRef: b.booking_ref,
        hostelName: tenant.name,
        tenantId: tenant.id,
      }).catch(() => {})
    }
  }

  // ── Admin/owner digest — one SMS + one email listing everything due.
  const admins = await getTenantAdminContacts(admin, tenant.id)
  if (admins.phones.length === 0 && admins.emails.length === 0) return

  const lines: string[] = []
  if (todayArrivals.length)
    lines.push(
      `${todayArrivals.length} arriving today: ${todayArrivals.map((b) => guestName(b.occupant)).join(', ')}`
    )
  if (overdueArrivals.length)
    lines.push(
      `${overdueArrivals.length} OVERDUE check-in (never checked in): ${overdueArrivals.map((b) => guestName(b.occupant)).join(', ')}`
    )
  if (todayDepartures.length)
    lines.push(
      `${todayDepartures.length} departing today: ${todayDepartures.map((b) => guestName(b.occupant)).join(', ')}`
    )
  if (overdueDepartures.length)
    lines.push(
      `${overdueDepartures.length} OVERDUE check-out (past date, still checked in): ${overdueDepartures.map((b) => guestName(b.occupant)).join(', ')}`
    )

  const smsLine = `Today — ${lines.join(' · ')}`

  if (admins.smsEnabled) {
    for (const phone of admins.phones) {
      sendAdminBookingAlert({
        phone,
        hostelName: tenant.name,
        eventLine: smsLine,
        tenantId: tenant.id,
      }).catch(() => {})
    }
  }

  if (admins.emailEnabled) {
    const emailLines = [
      ...todayArrivals.map((b) => ({
        label: 'Arriving today',
        value: `${guestName(b.occupant)} — ${roomLabel(b.room)} (${b.booking_ref})`,
      })),
      ...overdueArrivals.map((b) => ({
        label: 'OVERDUE check-in',
        value: `${guestName(b.occupant)} — ${roomLabel(b.room)} (${b.booking_ref})`,
      })),
      ...todayDepartures.map((b) => ({
        label: 'Departing today',
        value: `${guestName(b.occupant)} — ${roomLabel(b.room)} (${b.booking_ref})`,
      })),
      ...overdueDepartures.map((b) => ({
        label: 'OVERDUE check-out',
        value: `${guestName(b.occupant)} — ${roomLabel(b.room)} (${b.booking_ref})`,
      })),
    ]
    for (const email of admins.emails) {
      sendEmail({
        to: email,
        senderName: tenant.name,
        subject: `Today's arrivals & departures — ${tenant.name}`,
        html: adminAlertHtml({
          hostelName: tenant.name,
          primaryColor: tenant.primary_color ?? '#2563EB',
          logoUrl: tenant.logo_url,
          title: "Today's check-ins & check-outs",
          lines: emailLines,
        }),
      }).catch(() => {})
    }
  }
}
