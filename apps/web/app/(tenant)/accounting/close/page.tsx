import type { Metadata } from 'next'
import { Lock, Unlock } from 'lucide-react'

import { getAccountingPeriods } from '@/lib/data/periods'
import { getPnL } from '@/lib/data/accounting'
import { formatGHS } from '@/lib/utils'
import { ClosePeriodActions } from '@/components/accounting/close-period-actions'

export const metadata: Metadata = { title: 'Period Close' }

function buildLast12Months(): { year: number; month: number }[] {
  const now = new Date()
  const out: { year: number; month: number }[] = []
  for (let i = 1; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
  }
  return out
}

export default async function PeriodClosePage() {
  const periods = await getAccountingPeriods(24)

  const periodByKey = new Map(periods.map((p) => [`${p.year}-${p.month}`, p]))
  const months = buildLast12Months()

  // Compute on-the-fly P&L for each open prior month so the operator can see
  // what they're closing without leaving the page
  const proposals = await Promise.all(
    months.map(async (m) => {
      const closed = periodByKey.get(`${m.year}-${m.month}`)
      if (closed?.status === 'closed') {
        return {
          year:  m.year,
          month: m.month,
          monthLabel: new Date(m.year, m.month - 1, 1).toLocaleDateString('en-GH', { month: 'long', year: 'numeric' }),
          status: 'closed' as const,
          revenue: closed.revenue_total ?? 0,
          expense: closed.expense_total ?? 0,
          netProfit: closed.net_profit ?? 0,
          closedAt: closed.closed_at,
        }
      }
      const mm = String(m.month).padStart(2, '0')
      const dayMax = new Date(m.year, m.month, 0).getDate()
      const pnl = await getPnL(`${m.year}-${mm}-01`, `${m.year}-${mm}-${String(dayMax).padStart(2, '0')}`)
      return {
        year:  m.year,
        month: m.month,
        monthLabel: new Date(m.year, m.month - 1, 1).toLocaleDateString('en-GH', { month: 'long', year: 'numeric' }),
        status: 'open' as const,
        revenue: pnl.totalRevenue,
        expense: pnl.totalExpenses,
        netProfit: pnl.netProfit,
        closedAt: null,
      }
    })
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Period Close</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Closing a month posts revenue + expense balances to retained earnings and locks the period from edits.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[800px]">
          <thead className="bg-surface-raised">
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary w-44">Period</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary w-28">Status</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-32">Revenue</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-32">Expenses</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-32">Net profit</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-60">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {proposals.map((p) => (
              <tr key={`${p.year}-${p.month}`} className="hover:bg-surface-raised/50 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-text-primary">{p.monthLabel}</p>
                  {p.closedAt && (
                    <p className="mt-0.5 text-[11px] text-text-tertiary">
                      closed {new Date(p.closedAt).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  {p.status === 'closed' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                      <Lock className="h-3 w-3" /> Closed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-raised px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
                      <Unlock className="h-3 w-3" /> Open
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-sm tabular-nums currency-amount text-text-primary">
                  {p.revenue > 0 ? formatGHS(p.revenue) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-sm tabular-nums currency-amount text-text-secondary">
                  {p.expense > 0 ? formatGHS(p.expense) : '—'}
                </td>
                <td className={`px-4 py-3 text-right text-sm font-semibold tabular-nums currency-amount ${p.netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                  {p.netProfit === 0 ? '—' : `${p.netProfit < 0 ? '−' : ''}${formatGHS(Math.abs(p.netProfit))}`}
                </td>
                <td className="px-4 py-3 text-right">
                  <ClosePeriodActions year={p.year} month={p.month} status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 space-y-1">
        <p className="font-medium">Before closing a period</p>
        <ul className="list-disc pl-5 space-y-0.5">
          <li>Confirm bank reconciliation through the period end.</li>
          <li>Run depreciation for the month.</li>
          <li>Make sure all bills, payroll, and refunds for the month are posted.</li>
        </ul>
        <p className="pt-1">Once closed, the database trigger blocks any further journal entries in the period — reopening reverses the closing entry but should only be done by an accountant.</p>
      </div>
    </div>
  )
}
