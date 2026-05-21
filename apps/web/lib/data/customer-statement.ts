import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

export interface StatementLine {
  date:         string   // YYYY-MM-DD
  kind:         'invoice' | 'payment'
  reference:    string
  description:  string
  charge:       number   // pesewas (positive when invoiced)
  payment:      number   // pesewas (positive when paid)
  balance:      number   // running balance after this line
  link?:        string   // /invoices/<id> or /payments/...
}

export interface CustomerStatement {
  occupant: {
    id:         string
    first_name: string
    last_name:  string
    phone:      string | null
    email:      string | null
    institution:string | null
    student_id: string | null
  }
  asOf:           string
  openingBalance: number
  charges:        number
  payments:       number
  closingBalance: number
  lines:          StatementLine[]
}

/**
 * Builds a customer statement of account for the given occupant. Pulls every
 * booking (charge = final_amount on its check-in date) and every
 * booking_payment (payment = amount on paid_at) within range, sorts
 * chronologically, and computes running balance.
 */
export async function getCustomerStatement(
  occupantId: string,
  dateFrom?:  string,
  dateTo?:    string,
): Promise<CustomerStatement | null> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const from = dateFrom ?? `${new Date().getFullYear()}-01-01`
  const to   = dateTo   ?? today

  const [{ data: occupant }, { data: bookings }] = await Promise.all([
    (supabase as any)
      .from('occupants')
      .select('id, first_name, last_name, phone, email, institution, student_id')
      .eq('id', occupantId)
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    (supabase as any)
      .from('bookings')
      .select(`
        id, booking_ref, check_in_date, final_amount, status,
        booking_payments(id, amount, paid_at, status, method, reference)
      `)
      .eq('tenant_id', tenantId)
      .eq('occupant_id', occupantId)
      .not('status', 'in', '(enquiry,cancelled,refunded)')
      .order('check_in_date'),
  ])

  if (!occupant) return null

  // Build event list — charges on check_in_date, payments on paid_at
  type Event = { date: string; kind: 'invoice' | 'payment'; reference: string; description: string; amount: number; link?: string }
  const events: Event[] = []

  for (const b of (bookings ?? []) as any[]) {
    const date = b.check_in_date
    if (date) {
      events.push({
        date,
        kind: 'invoice',
        reference:   b.booking_ref ?? b.id.slice(0, 8),
        description: 'Accommodation invoice',
        amount:      Number(b.final_amount ?? 0),
        link:        `/invoices/${b.id}`,
      })
    }
    for (const p of ((b.booking_payments ?? []) as any[])) {
      if (p.status !== 'success' && p.status !== 'paid') continue
      events.push({
        date:        String(p.paid_at).slice(0, 10),
        kind:        'payment',
        reference:   p.reference ?? p.id.slice(0, 8),
        description: `Payment received · ${p.method ?? 'unknown'}`,
        amount:      Number(p.amount ?? 0),
      })
    }
  }

  // Opening balance = sum of events strictly before `from`
  events.sort((a, b) => a.date.localeCompare(b.date))
  let openingBalance = 0
  let runningBalance = 0
  const inRange: Event[] = []

  for (const e of events) {
    const delta = e.kind === 'invoice' ? e.amount : -e.amount
    runningBalance += delta
    if (e.date < from) {
      openingBalance = runningBalance
      continue
    }
    if (e.date > to) continue
    inRange.push(e)
  }

  // Re-walk to produce running balance starting from openingBalance
  let bal = openingBalance
  const lines: StatementLine[] = []
  let charges = 0
  let payments = 0
  for (const e of inRange) {
    const charge  = e.kind === 'invoice' ? e.amount : 0
    const payment = e.kind === 'payment' ? e.amount : 0
    bal += charge - payment
    charges  += charge
    payments += payment
    lines.push({
      date:        e.date,
      kind:        e.kind,
      reference:   e.reference,
      description: e.description,
      charge,
      payment,
      balance:     bal,
      link:        e.link,
    })
  }

  return {
    occupant,
    asOf:           to,
    openingBalance,
    charges,
    payments,
    closingBalance: bal,
    lines,
  }
}
