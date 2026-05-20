import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

export interface OutstandingInvoice {
  id:              string
  booking_ref:     string | null
  check_in_date:   string | null
  check_out_date:  string | null
  final_amount:    number
  paid_amount:     number
  balance:         number
  daysOverdue:     number
  bucket:          AgingBucketId
  occupant: {
    id:         string
    first_name: string
    last_name:  string
    other_names:string | null
    phone:      string | null
    email:      string | null
  } | null
}

export type AgingBucketId = 'current' | '1_30' | '31_60' | '61_90' | '90_plus'

export const AGING_BUCKETS: { id: AgingBucketId; label: string; sublabel: string }[] = [
  { id: 'current', label: 'Current',  sublabel: 'Not yet due' },
  { id: '1_30',    label: '1–30 days',sublabel: 'Just overdue' },
  { id: '31_60',   label: '31–60 days', sublabel: 'Past due' },
  { id: '61_90',   label: '61–90 days', sublabel: 'Significantly overdue' },
  { id: '90_plus', label: '90+ days', sublabel: 'Bad debt risk' },
]

export interface CustomerAging {
  occupant_id:        string
  first_name:         string
  last_name:          string
  phone:              string | null
  email:              string | null
  totalOutstanding:   number
  oldestDaysOverdue:  number
  invoiceCount:       number
  oldestInvoiceId:    string
  bucketTotals:       Record<AgingBucketId, number>
}

export interface AgingReport {
  asOf:               string
  totalOutstanding:   number
  bucketTotals:       Record<AgingBucketId, number>
  bucketCounts:       Record<AgingBucketId, number>
  invoices:           OutstandingInvoice[]
  customers:          CustomerAging[]
}

function classifyBucket(daysOverdue: number): AgingBucketId {
  if (daysOverdue <= 0)  return 'current'
  if (daysOverdue <= 30) return '1_30'
  if (daysOverdue <= 60) return '31_60'
  if (daysOverdue <= 90) return '61_90'
  return '90_plus'
}

function daysBetween(later: Date, earlier: Date): number {
  const ms = later.getTime() - earlier.getTime()
  return Math.floor(ms / (24 * 60 * 60 * 1000))
}

export async function getAgingReport(): Promise<AgingReport | null> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()

  const { data } = await (supabase as any)
    .from('bookings')
    .select(`
      id, booking_ref, check_in_date, check_out_date,
      final_amount, paid_amount,
      occupant:occupants(id, first_name, last_name, other_names, phone, email)
    `)
    .eq('tenant_id', tenantId)
    .not('status', 'in', '(enquiry,cancelled,refunded)')
    .order('check_in_date', { ascending: true })
    .limit(1000)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const asOf = today.toISOString().slice(0, 10)

  const invoices: OutstandingInvoice[] = []

  for (const row of (data ?? []) as any[]) {
    const final  = Number(row.final_amount ?? 0)
    const paid   = Number(row.paid_amount  ?? 0)
    const balance = Math.max(0, final - paid)
    if (balance <= 0) continue

    const due = row.check_in_date ? new Date(row.check_in_date) : null
    if (due) due.setHours(0, 0, 0, 0)
    const daysOverdue = due ? daysBetween(today, due) : 0

    const occ = Array.isArray(row.occupant) ? row.occupant[0] : row.occupant
    invoices.push({
      id:             row.id,
      booking_ref:    row.booking_ref,
      check_in_date:  row.check_in_date,
      check_out_date: row.check_out_date,
      final_amount:   final,
      paid_amount:    paid,
      balance,
      daysOverdue,
      bucket:         classifyBucket(daysOverdue),
      occupant:       occ ?? null,
    })
  }

  const bucketTotals: Record<AgingBucketId, number> = {
    current: 0, '1_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0,
  }
  const bucketCounts: Record<AgingBucketId, number> = {
    current: 0, '1_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0,
  }
  for (const inv of invoices) {
    bucketTotals[inv.bucket] += inv.balance
    bucketCounts[inv.bucket] += 1
  }

  // Roll up by customer
  const byCustomer = new Map<string, CustomerAging>()
  for (const inv of invoices) {
    if (!inv.occupant) continue
    const key = inv.occupant.id
    let row = byCustomer.get(key)
    if (!row) {
      row = {
        occupant_id:       inv.occupant.id,
        first_name:        inv.occupant.first_name,
        last_name:         inv.occupant.last_name,
        phone:             inv.occupant.phone,
        email:             inv.occupant.email,
        totalOutstanding:  0,
        oldestDaysOverdue: 0,
        invoiceCount:      0,
        oldestInvoiceId:   inv.id,
        bucketTotals: { current: 0, '1_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0 },
      }
      byCustomer.set(key, row)
    }
    row.totalOutstanding += inv.balance
    row.invoiceCount     += 1
    row.bucketTotals[inv.bucket] += inv.balance
    if (inv.daysOverdue > row.oldestDaysOverdue) {
      row.oldestDaysOverdue = inv.daysOverdue
      row.oldestInvoiceId   = inv.id
    }
  }

  const customers = Array.from(byCustomer.values())
    .sort((a, b) => b.oldestDaysOverdue - a.oldestDaysOverdue || b.totalOutstanding - a.totalOutstanding)

  const totalOutstanding = invoices.reduce((s, i) => s + i.balance, 0)

  return {
    asOf,
    totalOutstanding,
    bucketTotals,
    bucketCounts,
    invoices: invoices.sort((a, b) => b.daysOverdue - a.daysOverdue),
    customers,
  }
}
