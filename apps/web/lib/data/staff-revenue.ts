import { createAdminClient } from '@/lib/supabase/admin'

export interface StaffRevenueRow {
  staffId:       string
  staffName:     string
  staffEmail:    string
  paymentsCount: number
  cashTotal:     number
  digitalTotal:  number
  total:         number
}

/**
 * Get revenue collected per staff member for a given date range.
 * Groups booking_payments by `received_by`, plus (hotel tenants only)
 * booking_charges by `created_by` — a booking's true revenue is the room
 * payment plus whatever folio charges (minibar, laundry, etc.) that staff
 * member recorded, matching the "revenue by whoever brought it in" model.
 */
export async function getStaffRevenue(
  tenantId: string,
  from: string,
  to: string,
): Promise<StaffRevenueRow[]> {
  const supabase = createAdminClient()

  const [{ data: payments }, { data: charges }] = await Promise.all([
    supabase
      .from('booking_payments')
      .select('amount, method, received_by')
      .eq('tenant_id', tenantId)
      .eq('status', 'success')
      .gte('paid_at', from)
      .lte('paid_at', to)
      .not('received_by', 'is', null),
    supabase
      .from('booking_charges')
      .select('amount, payment_method, created_by')
      .eq('tenant_id', tenantId)
      .eq('paid', true)
      .not('payment_method', 'is', null)
      .gte('created_at', from)
      .lte('created_at', to),
  ])

  if ((!payments || payments.length === 0) && (!charges || charges.length === 0)) return []

  // Group by staff
  const map = new Map<string, { cash: number; digital: number; count: number }>()
  const staffIds = new Set<string>()

  for (const p of payments ?? []) {
    const sid = p.received_by as string
    staffIds.add(sid)
    const entry = map.get(sid) ?? { cash: 0, digital: 0, count: 0 }
    entry.count++
    if (p.method === 'cash') {
      entry.cash += p.amount
    } else {
      entry.digital += p.amount
    }
    map.set(sid, entry)
  }

  for (const c of charges ?? []) {
    const sid = c.created_by as string
    staffIds.add(sid)
    const entry = map.get(sid) ?? { cash: 0, digital: 0, count: 0 }
    entry.count++
    if (c.payment_method === 'cash') {
      entry.cash += c.amount
    } else {
      entry.digital += c.amount
    }
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
      staffName:     staff?.name ?? staffId.slice(0, 8),
      staffEmail:    staff?.email ?? '',
      paymentsCount: totals.count,
      cashTotal:     totals.cash,
      digitalTotal:  totals.digital,
      total:         totals.cash + totals.digital,
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
        id, amount, payment_method, created_at, description, notes,
        booking:bookings(booking_ref, occupant:occupants(first_name, last_name))
      `)
      .eq('tenant_id', tenantId)
      .eq('created_by', staffId)
      .eq('paid', true)
      .not('payment_method', 'is', null)
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false })
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
        date:         source === 'payment' ? r.paid_at : r.created_at,
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
