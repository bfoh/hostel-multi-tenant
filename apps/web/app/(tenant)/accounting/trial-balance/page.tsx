import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { getTrialBalance } from '@/lib/data/accounting'
import { formatGHS } from '@/lib/utils'

export const metadata: Metadata = { title: 'Trial Balance' }

const TYPE_ORDER = ['asset', 'liability', 'equity', 'revenue', 'expense']
const TYPE_LABELS: Record<string, string> = {
  asset:     'Assets',
  liability: 'Liabilities',
  equity:    'Equity',
  revenue:   'Revenue',
  expense:   'Expenses',
}

export default async function TrialBalancePage() {
  const lines = await getTrialBalance()

  const totalDebits  = lines.reduce((s, l) => s + l.total_debit,  0)
  const totalCredits = lines.reduce((s, l) => s + l.total_credit, 0)

  // Group by type
  const grouped = TYPE_ORDER.map((type) => ({
    type,
    label: TYPE_LABELS[type],
    lines: lines.filter((l) => l.type === type),
  })).filter((g) => g.lines.length > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/accounting" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" /> Accounting
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="text-sm font-medium text-text-primary">Trial Balance</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary w-20">Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Account</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary w-36">Debit</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary w-36">Credit</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((group) => (
              <>
                <tr key={group.type} className="bg-surface-raised">
                  <td colSpan={4} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                    {group.label}
                  </td>
                </tr>
                {group.lines.map((line) => (
                  <tr key={line.account_id} className="border-t border-border/40 hover:bg-surface-raised/50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-text-tertiary">{line.code}</td>
                    <td className="px-4 py-2.5 text-sm text-text-primary">{line.name}</td>
                    <td className="px-4 py-2.5 text-right text-sm currency-amount text-text-primary">
                      {line.total_debit > 0 ? formatGHS(line.total_debit) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm currency-amount text-text-secondary">
                      {line.total_credit > 0 ? formatGHS(line.total_credit) : '—'}
                    </td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-surface-raised">
              <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-text-primary">Totals</td>
              <td className="px-4 py-3 text-right text-sm font-semibold currency-amount text-text-primary">
                {formatGHS(totalDebits)}
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold currency-amount text-text-secondary">
                {formatGHS(totalCredits)}
              </td>
            </tr>
            {totalDebits !== totalCredits && (
              <tr>
                <td colSpan={4} className="px-4 py-2 text-xs text-danger text-center">
                  ⚠ Trial balance does not balance — difference: {formatGHS(Math.abs(totalDebits - totalCredits))}
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    </div>
  )
}
