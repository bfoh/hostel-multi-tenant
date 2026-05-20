import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

export interface AccountingPeriod {
  id:                string
  year:              number
  month:             number
  monthLabel:        string
  status:            'open' | 'closed'
  closed_at:         string | null
  closing_entry_id:  string | null
  net_profit:        number | null
  revenue_total:     number | null
  expense_total:     number | null
}

export async function getAccountingPeriods(limit = 24): Promise<AccountingPeriod[]> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return []

  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('accounting_periods')
    .select('id, year, month, status, closed_at, closing_entry_id, net_profit, revenue_total, expense_total')
    .eq('tenant_id', tenantId)
    .order('year',  { ascending: false })
    .order('month', { ascending: false })
    .limit(limit)

  return ((data ?? []) as any[]).map((p) => ({
    ...p,
    monthLabel: new Date(p.year, p.month - 1, 1).toLocaleDateString('en-GH', { month: 'long', year: 'numeric' }),
  })) as AccountingPeriod[]
}

/**
 * Returns the {year, month} for the most recent fully-closed period, or null.
 */
export async function getLastClosedPeriod(): Promise<{ year: number; month: number } | null> {
  const periods = await getAccountingPeriods(1)
  const closed = periods.find((p) => p.status === 'closed')
  return closed ? { year: closed.year, month: closed.month } : null
}
