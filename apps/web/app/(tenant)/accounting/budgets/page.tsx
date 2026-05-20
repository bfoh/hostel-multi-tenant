import type { Metadata } from 'next'

import { getBudgetVariance } from '@/lib/data/budgets'
import { formatGHS } from '@/lib/utils'
import { ExportCsvButton } from '@/components/accounting/export-csv-button'
import { BudgetMonthPicker, BudgetVarianceTable } from '@/components/accounting/budget-client'

export const metadata: Metadata = { title: 'Budgets & Variance' }

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const sp = await searchParams
  const now = new Date()
  const year  = sp.year  ? parseInt(sp.year,  10) : now.getFullYear()
  const month = sp.month ? parseInt(sp.month, 10) : now.getMonth() + 1

  const report = await getBudgetVariance(year, month)

  if (!report) {
    return (
      <div className="rounded-xl border border-border bg-surface p-12 text-center">
        <p className="text-sm text-text-secondary">No tenant context.</p>
      </div>
    )
  }

  const csvRows = [...report.revenue, ...report.expenses].map((r) => [
    r.code,
    r.name,
    r.type,
    (r.budget / 100).toFixed(2),
    (r.actual / 100).toFixed(2),
    (r.variance / 100).toFixed(2),
    r.variancePct === null ? '' : r.variancePct.toFixed(1),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Budgets &amp; Variance</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Per-account monthly budget vs actual ·{' '}
            <strong className="text-text-primary">{report.monthLabel}</strong>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BudgetMonthPicker year={year} month={month} />
          <ExportCsvButton
            filename={`budget-variance-${year}-${String(month).padStart(2, '0')}`}
            headers={['Code', 'Account', 'Type', 'Budget (GHS)', 'Actual (GHS)', 'Variance (GHS)', 'Variance %']}
            rows={csvRows}
          />
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi
          label="Revenue"
          budget={report.totals.budgetedRevenue}
          actual={report.totals.actualRevenue}
          variance={report.totals.revenueVariance}
          isFavorable={report.totals.revenueVariance >= 0}
        />
        <Kpi
          label="Expenses"
          budget={report.totals.budgetedExpenses}
          actual={report.totals.actualExpenses}
          variance={report.totals.expenseVariance}
          isFavorable={report.totals.expenseVariance <= 0}
        />
        <Kpi
          label="Net profit"
          budget={report.totals.budgetedNetProfit}
          actual={report.totals.actualNetProfit}
          variance={report.totals.netProfitVariance}
          isFavorable={report.totals.netProfitVariance >= 0}
        />
      </div>

      <BudgetVarianceTable
        year={year}
        month={month}
        revenue={report.revenue}
        expenses={report.expenses}
      />
    </div>
  )
}

function Kpi({
  label, budget, actual, variance, isFavorable,
}: {
  label:       string
  budget:      number
  actual:      number
  variance:    number
  isFavorable: boolean
}) {
  const tone = variance === 0 ? 'text-text-secondary' : isFavorable ? 'text-success' : 'text-danger'
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="mt-1 text-xl font-bold currency-amount text-text-primary">{formatGHS(actual)}</p>
      <p className="mt-1 text-[11px] text-text-tertiary">
        Budget {formatGHS(budget)} · <span className={tone}>{variance >= 0 ? '+' : '−'}{formatGHS(Math.abs(variance))}</span>
      </p>
    </div>
  )
}
