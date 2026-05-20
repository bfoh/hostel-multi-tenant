import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

export type BillStatus = 'draft' | 'approved' | 'partial' | 'paid' | 'cancelled'

export interface SupplierBill {
  id:                 string
  vendor_name:        string
  vendor_contact:     string | null
  bill_number:        string | null
  bill_date:          string
  due_date:           string
  category:           string
  description:        string
  amount:             number
  paid_amount:        number
  balance:            number
  status:             BillStatus
  expense_account_id: string | null
  approved_at:        string | null
  notes:              string | null
  created_at:         string
  daysUntilDue:       number   // negative = overdue
  currency_code:      string | null
  original_amount:    number | null
  fx_rate_used:       number | null
}

export interface BillFilters {
  status?: BillStatus | 'all' | 'open'
  vendor?: string
}

export interface ApSummary {
  totalOpenBills:     number
  totalOutstanding:   number
  overdueAmount:      number
  overdueCount:       number
  dueIn7DaysAmount:   number
  dueIn7DaysCount:    number
  byStatus:           Record<BillStatus, { count: number; amount: number }>
}

function daysUntil(date: string): number {
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return Math.floor((d.getTime() - t.getTime()) / (24 * 60 * 60 * 1000))
}

export async function getBills(filters: BillFilters = {}): Promise<SupplierBill[]> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return []

  const supabase = createAdminClient()
  let q = (supabase as any)
    .from('supplier_bills')
    .select(`
      id, vendor_name, vendor_contact, bill_number, bill_date, due_date,
      category, description, amount, paid_amount, status, expense_account_id,
      approved_at, notes, created_at,
      currency_code, original_amount, fx_rate_used
    `)
    .eq('tenant_id', tenantId)
    .order('due_date', { ascending: true })
    .limit(500)

  if (filters.status && filters.status !== 'all') {
    if (filters.status === 'open') {
      q = q.in('status', ['draft', 'approved', 'partial'])
    } else {
      q = q.eq('status', filters.status)
    }
  }
  if (filters.vendor) q = q.ilike('vendor_name', `%${filters.vendor}%`)

  const { data } = await q

  return ((data ?? []) as any[]).map((b) => ({
    ...b,
    balance:      Math.max(0, Number(b.amount) - Number(b.paid_amount)),
    daysUntilDue: daysUntil(b.due_date),
  })) as SupplierBill[]
}

export async function getApSummary(): Promise<ApSummary | null> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const all = await getBills({ status: 'all' })

  const summary: ApSummary = {
    totalOpenBills:    0,
    totalOutstanding:  0,
    overdueAmount:     0,
    overdueCount:      0,
    dueIn7DaysAmount:  0,
    dueIn7DaysCount:   0,
    byStatus: {
      draft:     { count: 0, amount: 0 },
      approved:  { count: 0, amount: 0 },
      partial:   { count: 0, amount: 0 },
      paid:      { count: 0, amount: 0 },
      cancelled: { count: 0, amount: 0 },
    },
  }

  for (const b of all) {
    summary.byStatus[b.status].count += 1
    summary.byStatus[b.status].amount += b.amount

    const isOpen = b.status === 'draft' || b.status === 'approved' || b.status === 'partial'
    if (!isOpen) continue

    summary.totalOpenBills   += 1
    summary.totalOutstanding += b.balance
    if (b.daysUntilDue < 0) {
      summary.overdueAmount += b.balance
      summary.overdueCount  += 1
    } else if (b.daysUntilDue <= 7) {
      summary.dueIn7DaysAmount += b.balance
      summary.dueIn7DaysCount  += 1
    }
  }

  return summary
}

export interface VendorBalance {
  vendor_name:      string
  openBillCount:    number
  totalOutstanding: number
  oldestDueDate:    string | null
}

export async function getVendorBalances(): Promise<VendorBalance[]> {
  const bills = await getBills({ status: 'open' })
  const map = new Map<string, VendorBalance>()
  for (const b of bills) {
    const k = b.vendor_name.trim().toLowerCase()
    let v = map.get(k)
    if (!v) {
      v = { vendor_name: b.vendor_name, openBillCount: 0, totalOutstanding: 0, oldestDueDate: null }
      map.set(k, v)
    }
    v.openBillCount    += 1
    v.totalOutstanding += b.balance
    if (!v.oldestDueDate || b.due_date < v.oldestDueDate) v.oldestDueDate = b.due_date
  }
  return Array.from(map.values()).sort((a, b) => b.totalOutstanding - a.totalOutstanding)
}
