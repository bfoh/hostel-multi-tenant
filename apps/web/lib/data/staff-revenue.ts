import { createAdminClient } from '@/lib/supabase/admin'
import type { PaymentMethod } from '@/lib/payments/methods'
import { getBookingReceiptBreakdown } from '@/lib/data/booking-finance'

export interface StaffRevenueRow {
  staffId:        string
  staffName:      string
  staffEmail:     string
  paymentsCount:  number
  roomRevenue:    number
  chargesRevenue: number
  total:          number
  methodTotals:   Partial<Record<PaymentMethod, { count: number; amount: number }>>
}

/**
 * Get revenue collected per staff member for a given date range.
 * Groups booking_payments by `received_by`, plus (hotel tenants only)
 * booking_charges by `created_by` — a booking's true revenue is the room
 * payment plus whatever folio charges (minibar, laundry, etc.) that staff
 * member recorded, matching the "revenue by whoever brought it in" model.
 * Broken down by exact payment method (not a cash/digital binary) and by
 * room-vs-charges, matching AMP Lodge's per-staff report.
 */
export async function getStaffRevenue(
  tenantId: string,
  from: string,
  to: string,
): Promise<StaffRevenueRow[]> {
  const supabase = createAdminClient()

  const endExclusive = new Date(new Date(to).getTime() + 1).toISOString()
  const receipts = await getBookingReceiptBreakdown(tenantId, from, endExclusive)
  const staffReceipts = receipts.filter((row) => row.collector_id)

  if (staffReceipts.length === 0) return []

  interface StaffAccumulator {
    roomRevenue:    number
    chargesRevenue: number
    count:          number
    methodTotals:   StaffRevenueRow['methodTotals']
  }

  // Group by staff
  const map = new Map<string, StaffAccumulator>()
  const staffIds = new Set<string>()

  function addMethod(entry: StaffAccumulator, method: string, amount: number, count: number) {
    const m = method as PaymentMethod
    const e = entry.methodTotals[m] ?? { count: 0, amount: 0 }
    e.count += count
    e.amount += amount
    entry.methodTotals[m] = e
  }

  for (const receipt of staffReceipts) {
    const sid = receipt.collector_id as string
    staffIds.add(sid)
    const entry = map.get(sid) ?? { roomRevenue: 0, chargesRevenue: 0, count: 0, methodTotals: {} }
    entry.count += receipt.transaction_count
    if (receipt.source === 'room_payment') entry.roomRevenue += receipt.total_amount
    else entry.chargesRevenue += receipt.total_amount
    addMethod(entry, receipt.method, receipt.total_amount, receipt.transaction_count)
    map.set(sid, entry)
  }

  // Fetch staff names
  const { data: users } = await supabase
    .from('tenant_members')
    .select('user_id, role, user:auth_user_id(email, raw_user_meta_data)')
    .eq('tenant_id', tenantId)
    .in('user_id', Array.from(staffIds))

  const nameMap = new Map<string, { name: string; email: string }>()
  for (const u of users ?? []) {
    const meta = (u as any).user?.raw_user_meta_data ?? {}
    const name = meta.full_name ?? meta.name ?? (u as any).user?.email ?? 'Unknown'
    const email = (u as any).user?.email ?? ''
    nameMap.set(u.user_id, { name, email })
  }

  // Build result
  const rows: StaffRevenueRow[] = []
  for (const [staffId, totals] of map) {
    const staff = nameMap.get(staffId)
    rows.push({
      staffId,
      staffName:      staff?.name ?? staffId.slice(0, 8),
      staffEmail:     staff?.email ?? '',
      paymentsCount:  totals.count,
      roomRevenue:    totals.roomRevenue,
      chargesRevenue: totals.chargesRevenue,
      total:          totals.roomRevenue + totals.chargesRevenue,
      methodTotals:   totals.methodTotals,
    })
  }

  // Sort by total descending
  rows.sort((a, b) => b.total - a.total)
  return rows
}

/**
 * Get individual transactions (room payments + folio charges) recorded by
 * a specific staff member, merged and sorted by date.
 */
export async function getStaffTransactions(
  tenantId: string,
  staffId: string,
  from: string,
  to: string,
) {
  const supabase = createAdminClient()

  const [{ data: payments }, { data: charges }] = await Promise.all([
    supabase
      .from('booking_payments')
      .select(`
        id, amount, method, paid_at, reference, notes,
        booking:bookings(booking_ref, occupant:occupants(first_name, last_name))
      `)
      .eq('tenant_id', tenantId)
      .eq('status', 'success')
      .eq('received_by', staffId)
      .gte('paid_at', from)
      .lte('paid_at', to)
      .order('paid_at', { ascending: false })
      .limit(100),
    supabase
      .from('booking_charges')
      .select(`
        id, amount, payment_method, updated_at, description, notes,
        booking:bookings(booking_ref, occupant:occupants(first_name, last_name))
      `)
      .eq('tenant_id', tenantId)
      .eq('created_by', staffId)
      .eq('paid', true)
      .not('payment_method', 'is', null)
      .gte('updated_at', from)
      .lte('updated_at', to)
      .order('updated_at', { ascending: false })
      .limit(100),
  ])

  function normalize(rows: any[], source: 'payment' | 'charge') {
    return rows.map((r) => {
      const booking  = Array.isArray(r.booking)  ? r.booking[0]  : r.booking
      const occupant = booking ? (Array.isArray(booking.occupant) ? booking.occupant[0] : booking.occupant) : null
      return {
        source,
        id:           r.id,
        amount:       r.amount,
        method:       source === 'payment' ? r.method : r.payment_method,
        date:         source === 'payment' ? r.paid_at : r.updated_at,
        reference:    r.reference ?? null,
        description:  r.description ?? null,
        notes:        r.notes ?? null,
        bookingRef:   booking?.booking_ref ?? '—',
        occupantName: occupant ? `${occupant.first_name} ${occupant.last_name}` : '—',
      }
    })
  }

  return [...normalize(payments ?? [], 'payment'), ...normalize(charges ?? [], 'charge')]
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
}
