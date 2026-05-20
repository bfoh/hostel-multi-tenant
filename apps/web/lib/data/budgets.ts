import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { getTrialBalance, type AccountType } from '@/lib/data/accounting'

export interface BudgetVarianceRow {
  account_id:   string
  code:         string
  name:         string
  type:         AccountType
  budget:       number          // pesewas (0 if unset)
  actual:       number          // pesewas
  variance:     number          // actual - budget (positive = exceeds budget)
  variancePct:  number | null   // null when budget = 0
  isFavorable:  boolean         // for revenue: actual > budget; for expense: actual < budget
}

export interface BudgetVarianceReport {
  year:           number
  month:          number
  monthLabel:     string
  periodStart:    string
  periodEnd:      string
  revenue:        BudgetVarianceRow[]
  expenses:       BudgetVarianceRow[]
  totals: {
    budgetedRevenue:    number
    actualRevenue:      number
    revenueVariance:    number
    budgetedExpenses:   number
    actualExpenses:     number
    expenseVariance:    number
    budgetedNetProfit:  number
    actualNetProfit:    number
    netProfitVariance:  number
  }
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

export async function getBudgetVariance(year: number, month: number): Promise<BudgetVarianceReport | null> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()

  const dayMax = daysInMonth(year, month)
  const mm = String(month).padStart(2, '0')
  const periodStart = `${year}-${mm}-01`
  const periodEnd   = `${year}-${mm}-${String(dayMax).padStart(2, '0')}`

  const [tb, { data: budgets }] = await Promise.all([
    getTrialBalance(periodStart, periodEnd),
    (supabase as any)
      .from('account_budgets')
      .select('account_id, amount')
      .eq('tenant_id', tenantId)
      .eq('year', year)
      .eq('month', month),
  ])

  const budgetMap = new Map<string, number>()
  for (const b of (budgets ?? []) as any[]) {
    budgetMap.set(b.account_id as string, Number(b.amount))
  }

  const mkRow = (line: typeof tb[number]): BudgetVarianceRow => {
    const budget = budgetMap.get(line.account_id) ?? 0
    const actual = line.balance
    const variance = actual - budget
    const variancePct = budget > 0 ? (variance / budget) * 100 : null
    const isFavorable = line.type === 'revenue' ? actual >= budget : actual <= budget
    return {
      account_id: line.account_id,
      code: line.code,
      name: line.name,
      type: line.type,
      budget,
      actual,
      variance,
      variancePct,
      isFavorable,
    }
  }

  // Include accounts that either have budget OR have activity OR are revenue/expense in COA.
  // tb only includes accounts with activity, so we also pull the COA list to surface zero-actual accounts with a budget.
  const { data: coa } = await (supabase as any)
    .from('chart_of_accounts')
    .select('id, code, name, type')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .in('type', ['revenue', 'expense'])

  const accountFromCoa = new Map((coa ?? []).map((a: any) => [a.id, a]))

  const seen = new Set<string>()
  const rows: BudgetVarianceRow[] = []

  for (const line of tb) {
    if (line.type !== 'revenue' && line.type !== 'expense') continue
    rows.push(mkRow(line))
    seen.add(line.account_id)
  }
  // Add budgeted accounts without activity
  for (const [accountId, amount] of budgetMap.entries()) {
    if (seen.has(accountId)) continue
    const coaRow: any = accountFromCoa.get(accountId)
    if (!coaRow) continue
    rows.push({
      account_id: accountId,
      code: coaRow.code,
      name: coaRow.name,
      type: coaRow.type,
      budget: amount,
      actual: 0,
      variance: -amount,
      variancePct: amount > 0 ? -100 : null,
      isFavorable: coaRow.type === 'expense',
    })
  }
  // Also surface revenue/expense accounts with no budget AND no activity so the
  // user can enter a budget directly without leaving the page
  for (const a of (coa ?? []) as any[]) {
    if (seen.has(a.id) || budgetMap.has(a.id)) continue
    rows.push({
      account_id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      budget: 0,
      actual: 0,
      variance: 0,
      variancePct: null,
      isFavorable: true,
    })
  }

  rows.sort((a, b) => a.code.localeCompare(b.code))

  const revenue  = rows.filter((r) => r.type === 'revenue')
  const expenses = rows.filter((r) => r.type === 'expense')

  const budgetedRevenue   = revenue.reduce((s, r) => s + r.budget,  0)
  const actualRevenue     = revenue.reduce((s, r) => s + r.actual,  0)
  const budgetedExpenses  = expenses.reduce((s, r) => s + r.budget,  0)
  const actualExpenses    = expenses.reduce((s, r) => s + r.actual,  0)

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-GH', { month: 'long', year: 'numeric' })

  return {
    year,
    month,
    monthLabel,
    periodStart,
    periodEnd,
    revenue,
    expenses,
    totals: {
      budgetedRevenue,
      actualRevenue,
      revenueVariance:    actualRevenue   - budgetedRevenue,
      budgetedExpenses,
      actualExpenses,
      expenseVariance:    actualExpenses  - budgetedExpenses,
      budgetedNetProfit:  budgetedRevenue - budgetedExpenses,
      actualNetProfit:    actualRevenue   - actualExpenses,
      netProfitVariance:  (actualRevenue - actualExpenses) - (budgetedRevenue - budgetedExpenses),
    },
  }
}
