import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { formatPhone, sendOverdueReminder } from '@/lib/sms'

interface RemindBody {
  /** Either a single bookingId for a per-invoice nudge, or occupantId to bundle all open balances. */
  booking_id?:  string
  occupant_id?: string
}

/**
 * POST /api/accounting/ar/remind
 *
 * Sends a payment-reminder SMS for either:
 *   - a single overdue invoice (booking_id)  → uses that booking's ref + balance
 *   - all of a customer's open invoices       → bundles the total balance and uses the oldest ref
 *
 * Falls back gracefully when no phone is on file (returns 400 with reason).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const h = await headers()
  const tenantId   = h.get('x-tenant-id')
  const tenantName = h.get('x-tenant-name') ?? 'Your Hostel'
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  let body: RemindBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body.booking_id && !body.occupant_id) {
    return NextResponse.json({ error: 'booking_id or occupant_id required' }, { status: 400 })
  }

  const admin = await createTenantAdminClientFromHeaders()
  const today = new Date(); today.setHours(0, 0, 0, 0)

  let phone:        string | null = null
  let firstName    = 'Customer'
  let balance       = 0           // pesewas
  let daysOverdue  = 0
  let bookingRef   = ''

  if (body.booking_id) {
    const { data: b } = await (admin as any)
      .from('bookings')
      .select('id, booking_ref, check_in_date, final_amount, paid_amount, occupant:occupants(first_name, phone)')
      .eq('id', body.booking_id)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (!b) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

    const occ = Array.isArray(b.occupant) ? b.occupant[0] : b.occupant
    phone = occ?.phone ?? null
    firstName = occ?.first_name ?? 'Customer'
    balance = Math.max(0, Number(b.final_amount) - Number(b.paid_amount))
    const dueDate = b.check_in_date ? new Date(b.check_in_date) : today
    daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000))
    bookingRef = b.booking_ref ?? b.id.slice(0, 8)
  } else if (body.occupant_id) {
    const { data: rows } = await (admin as any)
      .from('bookings')
      .select('id, booking_ref, check_in_date, final_amount, paid_amount, occupant:occupants(first_name, phone)')
      .eq('tenant_id', tenantId)
      .eq('occupant_id', body.occupant_id)
      .not('status', 'in', '(enquiry,cancelled,refunded)')

    if (!rows || rows.length === 0) return NextResponse.json({ error: 'No bookings for this occupant' }, { status: 404 })

    const openRows = (rows as any[])
      .filter((r) => Math.max(0, Number(r.final_amount) - Number(r.paid_amount)) > 0)
      .sort((a, b) => String(a.check_in_date).localeCompare(String(b.check_in_date)))

    if (openRows.length === 0) return NextResponse.json({ error: 'No open balance for this occupant' }, { status: 400 })

    balance = openRows.reduce((s, r) => s + Math.max(0, Number(r.final_amount) - Number(r.paid_amount)), 0)
    const oldest = openRows[0]
    const occ = Array.isArray(oldest.occupant) ? oldest.occupant[0] : oldest.occupant
    phone = occ?.phone ?? null
    firstName = occ?.first_name ?? 'Customer'
    const dueDate = oldest.check_in_date ? new Date(oldest.check_in_date) : today
    daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000))
    bookingRef = oldest.booking_ref ?? oldest.id.slice(0, 8)
  }

  if (balance <= 0) return NextResponse.json({ error: 'No outstanding balance' }, { status: 400 })
  if (!phone) return NextResponse.json({ error: 'No phone number on file for this customer' }, { status: 400 })

  const phoneFmt = formatPhone(phone)
  const balanceFmt = new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(balance / 100)

  try {
    await sendOverdueReminder({
      phone:       phoneFmt,
      firstName,
      balance:     balanceFmt,
      daysOverdue,
      bookingRef,
      hostelName:  tenantName,
      tenantId,
    })
  } catch (err) {
    return NextResponse.json({
      error: `Reminder failed: ${err instanceof Error ? err.message : 'unknown error'}`,
    }, { status: 500 })
  }

  return NextResponse.json({ ok: true, phone: phoneFmt, balance: balanceFmt })
}
