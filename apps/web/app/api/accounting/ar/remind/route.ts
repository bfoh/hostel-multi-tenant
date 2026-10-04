import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { formatPhone, sendOverdueReminder } from '@/lib/sms'
import { getBookingAgingRows } from '@/lib/data/booking-finance'
import { requireTenantRole } from '@/lib/auth/tenant-role'

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
  const tenantName = h.get('x-tenant-name') ?? 'Your Property'
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const role = await requireTenantRole(tenantId, ['owner', 'manager', 'receptionist', 'accountant'])
  if (role instanceof NextResponse) return role

  let body: RemindBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body.booking_id && !body.occupant_id) {
    return NextResponse.json({ error: 'booking_id or occupant_id required' }, { status: 400 })
  }

  const today = new Date(); today.setHours(0, 0, 0, 0)

  let phone:        string | null = null
  let firstName    = 'Customer'
  let balance       = 0           // pesewas
  let daysOverdue  = 0
  let bookingRef   = ''

  if (body.booking_id) {
    const rows = await getBookingAgingRows(tenantId, { bookingId: body.booking_id })
    const b = rows[0]
    if (!b) return NextResponse.json({ error: 'No open balance for this booking' }, { status: 400 })

    phone = b.phone
    firstName = b.first_name ?? 'Customer'
    balance = b.outstanding
    const dueDate = b.check_in_date ? new Date(b.check_in_date) : today
    daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000))
    bookingRef = b.booking_ref ?? b.id.slice(0, 8)
  } else if (body.occupant_id) {
    const openRows = await getBookingAgingRows(tenantId, { occupantId: body.occupant_id })
    if (openRows.length === 0) return NextResponse.json({ error: 'No open balance for this occupant' }, { status: 400 })

    balance = openRows.reduce((sum, item) => sum + item.outstanding, 0)
    const oldest = openRows[0]
    phone = oldest.phone
    firstName = oldest.first_name ?? 'Customer'
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
