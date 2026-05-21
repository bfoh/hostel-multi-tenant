import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

export type RecurringFrequency = 'monthly' | 'quarterly' | 'yearly'

export interface RecurringBill {
  id:                  string
  supplier_id:         string | null
  supplier_name:       string | null
  vendor_name:         string
  description:         string
  category:            string
  amount:              number
  expense_account_id:  string | null
  expense_account_label: string | null
  frequency:           RecurringFrequency
  day_of_month:        number
  due_day_offset:      number
  next_run_date:       string
  last_run_date:       string | null
  is_active:           boolean
  notes:               string | null
  isDue:               boolean
}

export interface RecurringJournal {
  id:              string
  name:            string
  description:     string
  frequency:       RecurringFrequency
  day_of_month:    number
  next_run_date:   string
  last_run_date:   string | null
  is_active:       boolean
  lines:           Array<{ account_id: string; side: 'debit' | 'credit'; amount: number; description?: string }>
  isDue:           boolean
}

function isDue(nextRun: string): boolean {
  return new Date(nextRun) <= new Date(new Date().toISOString().slice(0, 10))
}

/**
 * Computes the next run date after a successful run, given the chosen
 * frequency + day of month. Caps to month length when the chosen day
 * doesn't exist (e.g. Feb 30 → Feb 28/29).
 */
export function computeNextRunDate(from: Date, frequency: RecurringFrequency, dayOfMonth: number): string {
  const d = new Date(from)
  if (frequency === 'monthly')    d.setMonth(d.getMonth() + 1)
  if (frequency === 'quarterly')  d.setMonth(d.getMonth() + 3)
  if (frequency === 'yearly')     d.setFullYear(d.getFullYear() + 1)
  // clamp dayOfMonth into the resulting month's range
  const target = new Date(d.getFullYear(), d.getMonth(), 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(dayOfMonth, lastDay))
  return target.toISOString().slice(0, 10)
}

export async function getRecurringBills(): Promise<RecurringBill[]> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return []

  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('recurring_bills')
    .select(`
      id, supplier_id, vendor_name, description, category, amount,
      expense_account_id, frequency, day_of_month, due_day_offset,
      next_run_date, last_run_date, is_active, notes,
      supplier:suppliers(name),
      expense_account:chart_of_accounts(code, name)
    `)
    .eq('tenant_id', tenantId)
    .order('next_run_date', { ascending: true })
    .limit(200)

  return ((data ?? []) as any[]).map((r) => {
    const sup = Array.isArray(r.supplier) ? r.supplier[0] : r.supplier
    const acc = Array.isArray(r.expense_account) ? r.expense_account[0] : r.expense_account
    return {
      id:                    r.id,
      supplier_id:           r.supplier_id,
      supplier_name:         sup?.name ?? null,
      vendor_name:           r.vendor_name,
      description:           r.description,
      category:              r.category,
      amount:                Number(r.amount),
      expense_account_id:    r.expense_account_id,
      expense_account_label: acc ? `${acc.code} · ${acc.name}` : null,
      frequency:             r.frequency,
      day_of_month:          r.day_of_month,
      due_day_offset:        r.due_day_offset,
      next_run_date:         r.next_run_date,
      last_run_date:         r.last_run_date,
      is_active:             r.is_active,
      notes:                 r.notes,
      isDue:                 r.is_active && isDue(r.next_run_date),
    }
  }) as RecurringBill[]
}

export async function getRecurringJournals(): Promise<RecurringJournal[]> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return []

  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('recurring_journals')
    .select('id, name, description, frequency, day_of_month, next_run_date, last_run_date, is_active, lines')
    .eq('tenant_id', tenantId)
    .order('next_run_date', { ascending: true })
    .limit(200)

  return ((data ?? []) as any[]).map((r) => ({
    id:            r.id,
    name:          r.name,
    description:   r.description,
    frequency:     r.frequency,
    day_of_month:  r.day_of_month,
    next_run_date: r.next_run_date,
    last_run_date: r.last_run_date,
    is_active:     r.is_active,
    lines:         (r.lines ?? []) as any[],
    isDue:         r.is_active && isDue(r.next_run_date),
  })) as RecurringJournal[]
}
