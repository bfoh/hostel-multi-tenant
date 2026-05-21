import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { getBudgetVariance } from '@/lib/data/budgets'
import { formatGHS } from '@/lib/utils'
import { ExportCsvButton } from '@/components/accounting/export-csv-button'

export const metadata: Metadata = { title: 'Annual Budget vs Actual' }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default async function AnnualBudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const sp = await searchParams
  const year = sp.year ? parseInt(sp.year, 10) : new Date().getFullYear()

  // Pull all 12 monthly reports in parallel
  const monthly = await Promise.all(
    Array.from({ length: 12 }, (_, i) => getBudgetVariance(year, i + 1)),
  )

  // Build a per-account 12-month grid
  type CellMap = Map<number, { budget: number; actual: number }>
  type AccountRow = {
    account_id: string
    code:       string
    name:       string
    type:       'revenue' | 'expense'
    cells:      CellMap
    totalBudget:number
    totalActual:number
  }

  const byAccount = new Map<string, AccountRow>()

  monthly.forEach((m, idx) => {
    if (!m) return
    const month = idx + 1
    for (const r of [...m.revenue, ...m.expenses]) {
      let row = byAccount.get(r.account_id)
      if (!row) {
        row = {
          account_id:  r.account_id,
          code:        r.code,
          name:        r.name,
          type:        r.type as 'revenue' | 'expense',
          cells:       new Map(),
          totalBudget: 0,
          totalActual: 0,
        }
        byAccount.set(r.account_id, row)
      }
      const cur = row.cells.get(month) ?? { budget: 0, actual: 0 }
      cur.budget += r.budget
      cur.actual += r.actual
      row.cells.set(month, cur)
      row.totalBudget += r.budget
      row.totalActual += r.actual
    }
  })

  const sortedRows = Array.from(byAccount.values()).sort((a, b) => a.code.localeCompare(b.code))
  const revenueRows = sortedRows.filter((r) => r.type === 'revenue')
  const expenseRows = sortedRows.filter((r) => r.type === 'expense')

  function rowTone(type: 'revenue' | 'expense', variance: number) {
    if (variance === 0) return 'text-text-tertiary'
    const favorable = type === 'revenue' ? variance >= 0 : variance <= 0
    return favorable ? 'text-success' : 'text-danger'
  }

  const sectionTotal = (rows: AccountRow[]) => rows.reduce(
    (t, r) => ({ b: t.b + r.totalBudget, a: t.a + r.totalActual }),
    { b: 0, a: 0 },
  )

  const revTotal = sectionTotal(revenueRows)
  const expTotal = sectionTotal(expenseRows)
  const profitBudget = revTotal.b - expTotal.b
  const profitActual = revTotal.a - expTotal.a

  // CSV: account, type, jan budget, jan actual, ..., total budget, total actual
  const csvHeaders = ['Code', 'Account', 'Type',
    ...MONTHS.flatMap((m) => [`${m} budget`, `${m} actual`]),
    'YTD budget', 'YTD actual']
  const csvRows = sortedRows.map((r) => {
    const row: (string | number)[] = [r.code, r.name, r.type]
    for (let m = 1; m <= 12; m++) {
      const c = r.cells.get(m) ?? { budget: 0, actual: 0 }
      row.push((c.budget / 100).toFixed(2), (c.actual / 100).toFixed(2))
    }
    row.push((r.totalBudget / 100).toFixed(2), (r.totalActual / 100).toFixed(2))
    return row
  })

  return (
    <div className="space-y-6">
      <div>
        <Link href="/accounting/budgets" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Back to monthly budgets
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Annual Budget vs Actual · {year}</h1>
            <p className="mt-1 text-sm text-text-secondary">12-month grid showing budget and actual side-by-side per account</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form method="GET" className="flex items-center gap-2">
              <select
                name="year"
                defaultValue={year}
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs focus:border-brand focus:outline-none"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button type="submit" className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity">
                Apply
              </button>
            </form>
            <ExportCsvButton
              filename={`annual-budget-${year}`}
              headers={csvHeaders}
              rows={csvRows}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KpiRow label="Total revenue"  budget={revTotal.b} actual={revTotal.a} isFavorable={revTotal.a >= revTotal.b} />
        <KpiRow label="Total expenses" budget={expTotal.b} actual={expTotal.a} isFavorable={expTotal.a <= expTotal.b} />
        <KpiRow label="Net profit"     budget={profitBudget} actual={profitActual} isFavorable={profitActual >= profitBudget} />
      </div>

      <Section title="Revenue accounts" rows={revenueRows} rowTone={rowTone} />
      <Section title="Expense accounts" rows={expenseRows} rowTone={rowTone} />
    </div>
  )
}

function KpiRow({
  label, budget, actual, isFavorable,
}: {
  label: string
  budget: number
  actual: number
  isFavorable: boolean
}) {
  const variance = actual - budget
  const tone = variance === 0 ? 'text-text-secondary' : isFavorable ? 'text-success' : 'text-danger'
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="mt-1 text-xl font-bold currency-amount text-text-primary">{formatGHS(actual)}</p>
      <p className="mt-1 text-[11px] text-text-tertiary">
        Budget {formatGHS(budget)} ·{' '}
        <span className={tone}>{variance >= 0 ? '+' : '−'}{formatGHS(Math.abs(variance))}</span>
      </p>
    </div>
  )
}

function Section({
  title, rows, rowTone,
}: {
  title:   string
  rows:    Array<{
    account_id: string; code: string; name: string;
    cells: Map<number, { budget: number; actual: number }>
    totalBudget: number; totalActual: number;
    type: 'revenue' | 'expense'
  }>
  rowTone: (t: 'revenue' | 'expense', v: number) => string
}) {
  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="border-b border-border bg-surface-raised px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1400px] text-[11px]">
          <thead className="bg-surface">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left font-medium text-text-tertiary w-16">Code</th>
              <th className="px-3 py-2 text-left font-medium text-text-tertiary w-48">Account</th>
              {MONTHS.map((m) => (
                <th key={m} className="px-2 py-2 text-right font-medium text-text-tertiary w-24" colSpan={2}>{m}</th>
              ))}
              <th className="px-3 py-2 text-right font-medium text-text-tertiary w-28" colSpan={2}>YTD</th>
            </tr>
            <tr className="border-b border-border/40 text-[10px]">
              <th></th><th></th>
              {MONTHS.flatMap((m) => [
                <th key={m + '-b'} className="px-2 py-1 text-right font-normal text-text-tertiary">Budget</th>,
                <th key={m + '-a'} className="px-2 py-1 text-right font-normal text-text-tertiary">Actual</th>,
              ])}
              <th className="px-2 py-1 text-right font-normal text-text-tertiary">Budget</th>
              <th className="px-2 py-1 text-right font-normal text-text-tertiary">Actual</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {rows.length === 0 ? (
              <tr><td colSpan={26 + 2} className="px-3 py-4 text-center text-text-tertiary">No accounts in this section.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.account_id} className="hover:bg-surface-raised/30 transition-colors">
                <td className="px-3 py-1.5 font-mono text-text-tertiary">{r.code}</td>
                <td className="px-3 py-1.5 text-text-primary truncate max-w-xs">{r.name}</td>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                  const c = r.cells.get(m) ?? { budget: 0, actual: 0 }
                  const variance = c.actual - c.budget
                  return [
                    <td key={`${m}-b`} className="px-2 py-1.5 text-right tabular-nums text-text-tertiary">
                      {c.budget > 0 ? formatGHS(c.budget) : '—'}
                    </td>,
                    <td key={`${m}-a`} className={`px-2 py-1.5 text-right tabular-nums ${rowTone(r.type, variance)}`}>
                      {c.actual > 0 ? formatGHS(c.actual) : c.budget > 0 ? '—' : ''}
                    </td>,
                  ]
                })}
                <td className="px-2 py-1.5 text-right tabular-nums font-medium text-text-tertiary">{formatGHS(r.totalBudget)}</td>
                <td className={`px-2 py-1.5 text-right tabular-nums font-semibold ${rowTone(r.type, r.totalActual - r.totalBudget)}`}>{formatGHS(r.totalActual)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
