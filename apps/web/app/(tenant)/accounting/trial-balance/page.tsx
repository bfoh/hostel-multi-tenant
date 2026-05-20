import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, AlertTriangle } from 'lucide-react'

import { getTrialBalance } from '@/lib/data/accounting'
import { formatGHS } from '@/lib/utils'
import { PeriodPicker } from '@/components/accounting/period-picker'
import { ExportCsvButton } from '@/components/accounting/export-csv-button'

export const metadata: Metadata = { title: 'Trial Balance' }

const TYPE_ORDER = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const
const TYPE_LABELS: Record<string, string> = {
  asset:     'Assets',
  liability: 'Liabilities',
  equity:    'Equity',
  revenue:   'Revenue',
  expense:   'Expenses',
}

function defaultPeriod() {
  const now = new Date()
  const y = now.getFullYear()
  return {
    from: `${y}-01-01`,
    to:   now.toISOString().slice(0, 10),
  }
}

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { from: fromParam, to: toParam } = await searchParams
  const def = defaultPeriod()
  const dateFrom = fromParam ?? def.from
  const dateTo   = toParam   ?? def.to

  const lines = await getTrialBalance(dateFrom, dateTo)

  const totalDebits  = lines.reduce((s, l) => s + l.total_debit,  0)
  const totalCredits = lines.reduce((s, l) => s + l.total_credit, 0)
  const balanced = Math.abs(totalDebits - totalCredits) < 0.01

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    label: TYPE_LABELS[type],
    lines: lines.filter((l) => l.type === type),
  })).filter((g) => g.lines.length > 0)

  const csvRows = lines.map((l) => [
    l.code,
    l.name,
    l.type,
    (l.total_debit / 100).toFixed(2),
    (l.total_credit / 100).toFixed(2),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Trial Balance</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Debits and credits per account for the selected period
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker from={dateFrom} to={dateTo} />
          <ExportCsvButton
            filename={`trial-balance-${dateFrom}-to-${dateTo}`}
            headers={['Code', 'Account', 'Type', 'Debit (GHS)', 'Credit (GHS)']}
            rows={csvRows}
          />
        </div>
      </div>

      <div
        className={`rounded-xl border px-4 py-3 flex items-center gap-2 text-sm ${
          balanced
            ? 'border-success/30 bg-success/5 text-success'
            : 'border-danger/30 bg-danger/5 text-danger'
        }`}
      >
        {balanced
          ? <CheckCircle2 className="h-4 w-4" />
          : <AlertTriangle className="h-4 w-4" />}
        <span className="font-medium">
          {balanced
            ? 'In balance — debits equal credits'
            : `Out of balance by ${formatGHS(Math.abs(totalDebits - totalCredits))}`}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[700px]">
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
              <GroupBlock key={group.type} label={group.label} lines={group.lines} />
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
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function GroupBlock({
  label,
  lines,
}: {
  label: string
  lines: Awaited<ReturnType<typeof getTrialBalance>>
}) {
  return (
    <>
      <tr className="bg-surface-raised">
        <td colSpan={4} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
          {label}
        </td>
      </tr>
      {lines.map((line) => (
        <tr key={line.account_id} className="border-t border-border/40 hover:bg-surface-raised/50 transition-colors">
          <td className="px-4 py-2.5 font-mono text-xs text-text-tertiary">{line.code}</td>
          <td className="px-4 py-2.5 text-sm">
            <Link
              href={`/accounting/journal?account=${line.account_id}`}
              className="text-text-primary hover:text-brand transition-colors"
            >
              {line.name}
            </Link>
          </td>
          <td className="px-4 py-2.5 text-right text-sm currency-amount text-text-primary">
            {line.total_debit > 0 ? formatGHS(line.total_debit) : '—'}
          </td>
          <td className="px-4 py-2.5 text-right text-sm currency-amount text-text-secondary">
            {line.total_credit > 0 ? formatGHS(line.total_credit) : '—'}
          </td>
        </tr>
      ))}
    </>
  )
}
