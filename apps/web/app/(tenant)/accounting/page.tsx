import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Receipt,
  Landmark,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Activity,
  ArrowRight,
} from 'lucide-react'

import { getFinancialHealth } from '@/lib/data/accounting'
import { formatGHS } from '@/lib/utils'
import { TrendChart } from '@/components/accounting/trend-chart'

export const metadata: Metadata = { title: 'Accounting · Financial Health' }

export default async function AccountingDashboardPage() {
  const h = await getFinancialHealth()

  if (!h) {
    return (
      <div className="rounded-xl border border-border bg-surface p-12 text-center">
        <p className="text-sm text-text-secondary">No tenant context — sign in to view accounting data.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Financial Health</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Position snapshot as at{' '}
          <strong className="text-text-primary">
            {new Date(h.asOf).toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })}
          </strong>{' '}
          · Ghana VAT / NHIL / GETFund / PAYE compliant
        </p>
      </div>

      {/* Position KPIs — current state of cash + receivables/payables */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile
          label="Cash position"
          value={formatGHS(h.cashPosition)}
          icon={Wallet}
          tone="brand"
          sublabel={
            h.cashRunwayMonths !== null
              ? `${h.cashRunwayMonths.toFixed(1)} mo runway`
              : 'No burn data yet'
          }
        />
        <KpiTile
          label="Accounts receivable"
          value={formatGHS(h.arOutstanding)}
          icon={ArrowDownToLine}
          tone={h.arOutstanding > 0 ? 'warning' : 'neutral'}
          sublabel="Customers owe us"
        />
        <KpiTile
          label="Accounts payable"
          value={formatGHS(h.apOutstanding)}
          icon={ArrowUpFromLine}
          tone={h.apOutstanding > 0 ? 'danger' : 'neutral'}
          sublabel="We owe suppliers"
        />
        <KpiTile
          label="Tax payable"
          value={formatGHS(h.vatPayable + h.payeAndSsnitPayable)}
          icon={Receipt}
          tone={(h.vatPayable + h.payeAndSsnitPayable) > 0 ? 'warning' : 'neutral'}
          sublabel={`VAT ${formatGHS(h.vatPayable)} · PAYE/SSNIT ${formatGHS(h.payeAndSsnitPayable)}`}
        />
      </div>

      {/* Performance KPIs — MTD/YTD */}
      <div className="grid gap-4 sm:grid-cols-2">
        <PerfPanel title="Month to date" data={h.mtd} />
        <PerfPanel title="Year to date"  data={h.ytd} />
      </div>

      {/* Trend chart */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="border-b border-border bg-surface-raised px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-semibold text-text-primary">6-Month Trend</h2>
          </div>
          <Link
            href="/accounting/pnl"
            className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-brand transition-colors"
          >
            Full P&amp;L <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="p-4 text-text-secondary">
          <TrendChart data={h.monthlyTrend} />
        </div>
      </div>

      {/* Ratios + Top accounts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="border-b border-border bg-surface-raised px-4 py-3">
            <h2 className="text-sm font-semibold text-text-primary">Key ratios</h2>
            <p className="mt-0.5 text-[11px] text-text-tertiary">YTD performance · current snapshot</p>
          </div>
          <div className="divide-y divide-border/40">
            <RatioRow
              label="Net margin"
              value={h.ratios.netMargin === null ? null : `${(h.ratios.netMargin * 100).toFixed(1)}%`}
              hint="Net profit ÷ revenue (YTD)"
              healthy={h.ratios.netMargin !== null && h.ratios.netMargin >= 0.1}
            />
            <RatioRow
              label="Current ratio"
              value={h.ratios.currentRatio === null ? null : h.ratios.currentRatio.toFixed(2)}
              hint="Current assets ÷ current liabilities"
              healthy={h.ratios.currentRatio !== null && h.ratios.currentRatio >= 1.5}
              warning={h.ratios.currentRatio !== null && h.ratios.currentRatio < 1.0}
            />
            <RatioRow
              label="Quick ratio"
              value={h.ratios.quickRatio === null ? null : h.ratios.quickRatio.toFixed(2)}
              hint="(Current assets − inventory) ÷ current liab."
              healthy={h.ratios.quickRatio !== null && h.ratios.quickRatio >= 1.0}
              warning={h.ratios.quickRatio !== null && h.ratios.quickRatio < 0.7}
            />
            <RatioRow
              label="Debt to equity"
              value={h.ratios.debtToEquity === null ? null : h.ratios.debtToEquity.toFixed(2)}
              hint="Total liabilities ÷ total equity"
              healthy={h.ratios.debtToEquity !== null && h.ratios.debtToEquity <= 1.0}
              warning={h.ratios.debtToEquity !== null && h.ratios.debtToEquity > 2.0}
            />
          </div>
        </div>

        <TopAccountsPanel
          title="Top revenue (MTD)"
          tone="success"
          rows={h.topRevenueMtd}
          icon={TrendingUp}
          href="/accounting/pnl"
        />
        <TopAccountsPanel
          title="Top expenses (MTD)"
          tone="danger"
          rows={h.topExpensesMtd}
          icon={TrendingDown}
          href="/accounting/expenses"
        />
      </div>

      {/* Position summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <PositionCard label="Total assets"      value={formatGHS(h.totalAssets)}      tone="success" />
        <PositionCard label="Total liabilities" value={formatGHS(h.totalLiabilities)} tone="danger"  />
        <PositionCard label="Total equity"      value={formatGHS(h.totalEquity)}      tone="brand"   />
      </div>

      {/* Compliance reminder */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm dark:border-amber-800 dark:bg-amber-950/40">
        <p className="font-medium text-amber-800 dark:text-amber-300">Ghana statutory rates applied</p>
        <p className="mt-1 text-amber-700 dark:text-amber-400">
          VAT 15% · NHIL 2.5% · GETFund 2.5% · SSNIT Employee 5.5% · SSNIT Employer 13% · GRA PAYE 2024 bands
        </p>
      </div>
    </div>
  )
}

/* ── Components ─────────────────────────────────────────────────────────── */

function KpiTile({
  label, value, icon: Icon, tone, sublabel,
}: {
  label: string
  value: string
  icon: React.ElementType
  tone: 'brand' | 'success' | 'danger' | 'warning' | 'neutral'
  sublabel?: string
}) {
  const toneColor = {
    brand:   'text-brand',
    success: 'text-success',
    danger:  'text-danger',
    warning: 'text-warning',
    neutral: 'text-text-secondary',
  }[tone]

  const toneBg = {
    brand:   'bg-brand/10',
    success: 'bg-success/10',
    danger:  'bg-danger/10',
    warning: 'bg-warning/10',
    neutral: 'bg-surface-raised',
  }[tone]

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-text-secondary">{label}</p>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${toneBg}`}>
          <Icon className={`h-3.5 w-3.5 ${toneColor}`} />
        </div>
      </div>
      <p className={`mt-2 text-xl font-bold currency-amount ${toneColor}`}>{value}</p>
      {sublabel && <p className="mt-1 text-[11px] text-text-tertiary truncate">{sublabel}</p>}
    </div>
  )
}

function PerfPanel({
  title,
  data,
}: {
  title: string
  data: { revenue: number; expenses: number; netProfit: number }
}) {
  const margin = data.revenue > 0 ? (data.netProfit / data.revenue) * 100 : null
  const profitTone = data.netProfit >= 0 ? 'text-success' : 'text-danger'

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-text-tertiary">{title}</p>
        {margin !== null && (
          <span className={`text-xs font-medium ${margin >= 0 ? 'text-success' : 'text-danger'}`}>
            {margin.toFixed(1)}% margin
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[11px] text-text-tertiary">Revenue</p>
          <p className="mt-0.5 text-base font-bold currency-amount text-success">{formatGHS(data.revenue)}</p>
        </div>
        <div>
          <p className="text-[11px] text-text-tertiary">Expenses</p>
          <p className="mt-0.5 text-base font-bold currency-amount text-danger">{formatGHS(data.expenses)}</p>
        </div>
        <div>
          <p className="text-[11px] text-text-tertiary">Net profit</p>
          <p className={`mt-0.5 text-base font-bold currency-amount ${profitTone}`}>{formatGHS(data.netProfit)}</p>
        </div>
      </div>
    </div>
  )
}

function RatioRow({
  label, value, hint, healthy, warning,
}: {
  label: string
  value: string | null
  hint: string
  healthy?: boolean
  warning?: boolean
}) {
  const valueTone = value === null
    ? 'text-text-tertiary'
    : warning
    ? 'text-danger'
    : healthy
    ? 'text-success'
    : 'text-text-primary'

  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        <p className="mt-0.5 text-[11px] text-text-tertiary">{hint}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-base font-semibold tabular-nums ${valueTone}`}>{value ?? '—'}</p>
        {warning && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-danger">
            <AlertCircle className="h-2.5 w-2.5" />
            Watch
          </span>
        )}
      </div>
    </div>
  )
}

function TopAccountsPanel({
  title, tone, rows, icon: Icon, href,
}: {
  title: string
  tone: 'success' | 'danger'
  rows: { account_id: string; code: string; name: string; amount: number }[]
  icon: React.ElementType
  href: string
}) {
  const max = rows.length > 0 ? rows[0].amount : 0
  const color = tone === 'success' ? 'text-success' : 'text-danger'
  const bar   = tone === 'success' ? 'bg-success/40' : 'bg-danger/40'

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="border-b border-border bg-surface-raised px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        </div>
        <Link
          href={href}
          className="text-xs text-text-secondary hover:text-brand transition-colors"
        >
          View →
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-text-tertiary">No activity this month.</p>
      ) : (
        <div className="divide-y divide-border/40">
          {rows.map((r) => {
            const share = max > 0 ? (r.amount / max) * 100 : 0
            return (
              <Link
                key={r.account_id}
                href={`/accounting/journal?account=${r.account_id}`}
                className="block px-4 py-2.5 hover:bg-surface-raised/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-text-tertiary">{r.code}</span>
                      <span className="text-sm text-text-primary truncate">{r.name}</span>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold currency-amount ${color}`}>{formatGHS(r.amount)}</span>
                </div>
                <div className="mt-1.5 h-1 w-full rounded-full bg-surface-raised overflow-hidden">
                  <div className={`h-full ${bar}`} style={{ width: `${share}%` }} />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PositionCard({
  label, value, tone,
}: {
  label: string
  value: string
  tone: 'success' | 'danger' | 'brand'
}) {
  const color = { success: 'text-success', danger: 'text-danger', brand: 'text-brand' }[tone]
  return (
    <Link
      href="/accounting/balance-sheet"
      className="block rounded-xl border border-border bg-surface p-4 hover:bg-surface-raised transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-text-secondary">{label}</p>
        <Landmark className={`h-3.5 w-3.5 ${color} opacity-60`} />
      </div>
      <p className={`mt-2 text-xl font-bold currency-amount ${color}`}>{value}</p>
    </Link>
  )
}
