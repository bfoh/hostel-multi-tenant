import type { Metadata } from 'next'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

import { getCashFlow } from '@/lib/data/accounting'
import { formatGHS } from '@/lib/utils'
import { PeriodPicker } from '@/components/accounting/period-picker'
import { ExportCsvButton } from '@/components/accounting/export-csv-button'

export const metadata: Metadata = { title: 'Cash Flow Statement' }

function defaultDates() {
  const now = new Date()
  const y   = now.getFullYear()
  const m   = String(now.getMonth() + 1).padStart(2, '0')
  return { from: `${y}-${m}-01`, to: now.toISOString().slice(0, 10) }
}

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { from: fromParam, to: toParam } = await searchParams
  const defaults = defaultDates()
  const dateFrom = fromParam ?? defaults.from
  const dateTo   = toParam   ?? defaults.to

  const cf = await getCashFlow(dateFrom, dateTo)

  const csvRows: (string | number)[][] = cf.operating.map((row) => [
    'operating',
    row.label,
    (row.amount / 100).toFixed(2),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Cash Flow Statement</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Direct-method cash movements across all accounts for the period
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker from={dateFrom} to={dateTo} />
          <ExportCsvButton
            filename={`cash-flow-${dateFrom}-to-${dateTo}`}
            headers={['Section', 'Description', 'Amount (GHS)']}
            rows={csvRows}
          />
        </div>
      </div>

      <div className={`rounded-xl border-2 p-6 flex items-center justify-between ${
        cf.netChange > 0
          ? 'border-success/40 bg-success/5'
          : cf.netChange < 0
          ? 'border-danger/40 bg-danger/5'
          : 'border-border bg-surface'
      }`}>
        <div>
          <p className="text-sm text-text-secondary">Net Cash Change</p>
          <p className={`mt-1 text-3xl font-bold currency-amount ${
            cf.netChange > 0 ? 'text-success' : cf.netChange < 0 ? 'text-danger' : 'text-text-primary'
          }`}>
            {cf.netChange >= 0 ? '' : '−'}{formatGHS(Math.abs(cf.netChange))}
          </p>
          <p className="mt-1 text-xs text-text-tertiary">All activities for period</p>
        </div>
        {cf.netChange > 0
          ? <TrendingUp  className="h-10 w-10 text-success opacity-60" />
          : cf.netChange < 0
          ? <TrendingDown className="h-10 w-10 text-danger opacity-60" />
          : <Minus className="h-10 w-10 text-text-tertiary opacity-60" />}
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="border-b border-border bg-surface-raised px-4 py-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
            Operating Activities
          </h2>
        </div>

        {cf.operating.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-text-tertiary">
            No cash movements in this period.
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {cf.operating.map((row, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  {row.amount >= 0
                    ? <TrendingUp  className="h-3.5 w-3.5 shrink-0 text-success" />
                    : <TrendingDown className="h-3.5 w-3.5 shrink-0 text-danger" />}
                  <span className="text-text-secondary">{row.label}</span>
                </div>
                <span className={`font-semibold currency-amount ${row.amount >= 0 ? 'text-success' : 'text-danger'}`}>
                  {row.amount >= 0 ? '' : '−'}{formatGHS(Math.abs(row.amount))}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-border bg-surface-raised px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs font-semibold text-text-secondary">Net from Operating</span>
          <span className={`text-sm font-bold currency-amount ${cf.totalOperating >= 0 ? 'text-success' : 'text-danger'}`}>
            {cf.totalOperating >= 0 ? '' : '−'}{formatGHS(Math.abs(cf.totalOperating))}
          </span>
        </div>
      </div>

      {['Investing Activities', 'Financing Activities'].map((section) => (
        <div key={section} className="rounded-xl border border-dashed border-border bg-surface overflow-hidden">
          <div className="border-b border-border/50 bg-surface-raised px-4 py-2.5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-text-tertiary">{section}</h2>
          </div>
          <div className="px-4 py-4 text-xs text-text-tertiary italic">
            No transactions tracked yet — populates as investing/financing journal entries are tagged.
          </div>
          <div className="border-t border-border/50 bg-surface-raised px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-text-tertiary">Net from {section.split(' ')[0]}</span>
            <span className="text-sm font-bold text-text-tertiary currency-amount">{formatGHS(0)}</span>
          </div>
        </div>
      ))}

      <div className="rounded-xl border border-border bg-surface-raised px-5 py-3 text-xs text-text-secondary">
        Cash flows are derived from journal lines touching cash &amp; MoMo accounts.
        Positive = cash in · Negative = cash out.
      </div>
    </div>
  )
}
