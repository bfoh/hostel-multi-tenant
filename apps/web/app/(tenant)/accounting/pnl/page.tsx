import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { getPnL } from '@/lib/data/accounting'
import { formatGHS } from '@/lib/utils'

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/accounting" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
            <ChevronLeft className="h-4 w-4" /> Accounting
          </Link>
          <span className="text-text-disabled">/</span>
          <span className="text-sm font-medium text-text-primary">Profit & Loss</span>
        </div>
        <PeriodForm from={dateFrom} to={dateTo} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-secondary">Total Revenue</p>
          <p className="mt-1 text-xl font-bold text-success currency-amount">{formatGHS(report.totalRevenue)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-secondary">Total Expenses</p>
          <p className="mt-1 text-xl font-bold text-danger currency-amount">{formatGHS(report.totalExpenses)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-secondary">Net Profit / Loss</p>
          <p className={`mt-1 text-xl font-bold currency-amount ${profitColor}`}>{formatGHS(report.netProfit)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue section */}
        <Section title="Revenue" items={report.revenue} total={report.totalRevenue} color="text-success" />
        {/* Expenses section */}
        <Section title="Expenses" items={report.expenses} total={report.totalExpenses} color="text-danger" />
      </div>

      {/* Net profit row */}
      <div className={`rounded-xl border-2 p-5 ${report.netProfit >= 0 ? 'border-success/30 bg-success/5' : 'border-danger/30 bg-danger/5'}`}>
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold text-text-primary">
            {report.netProfit >= 0 ? 'Net Profit' : 'Net Loss'}
          </p>
          <p className={`text-2xl font-bold currency-amount ${profitColor}`}>
            {report.netProfit < 0 ? '(' : ''}{formatGHS(Math.abs(report.netProfit))}{report.netProfit < 0 ? ')' : ''}
          </p>
        </div>
        <p className="mt-1 text-xs text-text-tertiary">
          For period {new Date(dateFrom).toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })} – {new Date(dateTo).toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>
    </div>
  )
}

function Section({
  title,
  items,
  total,
  color,
}: {
  title: string
  items: { account_id: string; code: string; name: string; amount: number }[]
  total: number
  color: string
}) {
  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-text-tertiary text-center">No {title.toLowerCase()} recorded.</p>
      ) : (
        <>
          <div className="divide-y divide-border/40">
            {items.map((item) => (
              <div key={item.account_id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span className="font-mono text-xs text-text-tertiary mr-2">{item.code}</span>
                  <span className="text-sm text-text-primary">{item.name}</span>
                </div>
                <span className={`text-sm font-medium currency-amount ${color}`}>{formatGHS(item.amount)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border bg-surface-raised px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-text-primary">Total {title}</span>
            <span className={`text-sm font-bold currency-amount ${color}`}>{formatGHS(total)}</span>
          </div>
        </>
      )}
    </div>
  )
}

function PeriodForm({ from, to }: { from: string; to: string }) {
  return (
    <form className="flex items-center gap-2 text-sm">
      <label className="text-text-secondary">From</label>
      <input
        type="date"
        name="from"
        defaultValue={from}
        className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
      />
      <label className="text-text-secondary">To</label>
      <input
        type="date"
        name="to"
        defaultValue={to}
        className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
      />
      <button
        type="submit"
        className="rounded-md bg-brand px-3 py-1 text-sm font-medium text-white hover:bg-brand-hover transition-colors"
      >
        Apply
      </button>
    </form>
  )
}
