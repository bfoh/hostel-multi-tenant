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
 * Groups booking_payments by `received_by` user.
 */
export async function getStaffRevenue(
  tenantId: string,
  from: string,
  to: string,
): Promise<StaffRevenueRow[]> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('booking_payments')
    .select('amount, method, received_by')
    .eq('tenant_id', tenantId)
    .eq('status', 'success')
    .gte('paid_at', from)
    .lte('paid_at', to)
    .not('received_by', 'is', null)

  if (!data || data.length === 0) return []

  // Group by staff
  const map = new Map<string, { cash: number; digital: number; count: number }>()
  const staffIds = new Set<string>()

  for (const p of data) {
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
 * Get individual transactions by a specific staff member.
 */
export async function getStaffTransactions(
  tenantId: string,
  staffId: string,
  from: string,
  to: string,
) {
  const supabase = createAdminClient()

  const { data } = await supabase
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
    .limit(100)

  return (data ?? []).map((p) => {
    const booking  = Array.isArray(p.booking)  ? p.booking[0]  : p.booking
    const occupant = booking ? (Array.isArray(booking.occupant) ? booking.occupant[0] : booking.occupant) : null
    return {
      ...p,
      bookingRef: booking?.booking_ref ?? '—',
      occupantName: occupant ? `${occupant.first_name} ${occupant.last_name}` : '—',
    }
  })
}
