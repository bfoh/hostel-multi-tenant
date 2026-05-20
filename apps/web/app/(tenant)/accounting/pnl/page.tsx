import type { Metadata } from 'next'

import { getPnL } from '@/lib/data/accounting'
import { formatGHS } from '@/lib/utils'
import { PeriodPicker } from '@/components/accounting/period-picker'
import { ExportCsvButton } from '@/components/accounting/export-csv-button'

export const metadata: Metadata = { title: 'P&L Statement' }

export default async function PnLPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { from, to } = await searchParams
  const now   = new Date()
  const year  = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const dateFrom = from ?? `${year}-${month}-01`
  const dateTo   = to   ?? now.toISOString().slice(0, 10)

  const report = await getPnL(dateFrom, dateTo)
  const profitColor = report.netProfit >= 0 ? 'text-success' : 'text-danger'
  const margin = report.totalRevenue > 0
    ? (report.netProfit / report.totalRevenue) * 100
    : null

  const csvRows: (string | number)[][] = [
    ...report.revenue.map((r) => [r.code, r.name, 'revenue', (r.amount / 100).toFixed(2)]),
    ...report.expenses.map((r) => [r.code, r.name, 'expense', (r.amount / 100).toFixed(2)]),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Profit &amp; Loss</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Revenue minus expenses for the selected period
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker from={dateFrom} to={dateTo} />
          <ExportCsvButton
            filename={`pnl-${dateFrom}-to-${dateTo}`}
            headers={['Code', 'Account', 'Section', 'Amount (GHS)']}
            rows={csvRows}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Total Revenue"  value={formatGHS(report.totalRevenue)}  tone="success" />
        <KpiCard label="Total Expenses" value={formatGHS(report.totalExpenses)} tone="danger"  />
        <KpiCard
          label="Net Profit / Loss"
          value={formatGHS(report.netProfit)}
          tone={report.netProfit >= 0 ? 'success' : 'danger'}
          sublabel={margin !== null ? `${margin.toFixed(1)}% margin` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Revenue" items={report.revenue} total={report.totalRevenue} tone="text-success" />
        <Section title="Expenses" items={report.expenses} total={report.totalExpenses} tone="text-danger" />
      </div>

      <div className={`rounded-xl border-2 p-5 ${report.netProfit >= 0 ? 'border-success/30 bg-success/5' : 'border-danger/30 bg-danger/5'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-text-primary">
              {report.netProfit >= 0 ? 'Net Profit' : 'Net Loss'}
            </p>
            <p className="mt-1 text-xs text-text-tertiary">
              {new Date(dateFrom).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })} —{' '}
              {new Date(dateTo).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <p className={`text-2xl font-bold currency-amount ${profitColor}`}>
            {report.netProfit < 0 ? '(' : ''}{formatGHS(Math.abs(report.netProfit))}{report.netProfit < 0 ? ')' : ''}
          </p>
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  tone,
  sublabel,
}: {
  label: string
  value: string
  tone: 'success' | 'danger'
  sublabel?: string
}) {
  const color = tone === 'success' ? 'text-success' : 'text-danger'
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={`mt-1 text-xl font-bold currency-amount ${color}`}>{value}</p>
      {sublabel && <p className="mt-1 text-[11px] text-text-tertiary">{sublabel}</p>}
    </div>
  )
}

function Section({
  title,
  items,
  total,
  tone,
}: {
  title: string
  items: { account_id: string; code: string; name: string; amount: number }[]
  total: number
  tone: string
}) {
  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-text-tertiary text-center">No {title.toLowerCase()} in period.</p>
      ) : (
        <>
          <div className="divide-y divide-border/40">
            {items.map((item) => {
              const share = total > 0 ? (item.amount / total) * 100 : 0
              return (
                <div key={item.account_id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-text-tertiary">{item.code}</span>
                      <span className="text-sm text-text-primary truncate">{item.name}</span>
                    </div>
                    {share > 0 && (
                      <div className="mt-1 h-1 w-full rounded-full bg-surface-raised overflow-hidden">
                        <div
                          className={tone === 'text-success' ? 'h-full bg-success/40' : 'h-full bg-danger/40'}
                          style={{ width: `${Math.min(100, share)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`text-sm font-medium currency-amount ${tone}`}>{formatGHS(item.amount)}</span>
                    {share > 0 && <p className="text-[10px] text-text-tertiary">{share.toFixed(1)}%</p>}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="border-t border-border bg-surface-raised px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-text-primary">Total {title}</span>
            <span className={`text-sm font-bold currency-amount ${tone}`}>{formatGHS(total)}</span>
          </div>
        </>
      )}
    </div>
  )
}
