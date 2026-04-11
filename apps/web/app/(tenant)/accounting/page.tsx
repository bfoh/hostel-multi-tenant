import type { Metadata } from 'next'
import Link from 'next/link'
import { TrendingUp, TrendingDown, DollarSign, BookOpen, Scale, BarChart3, GitMerge, Landmark, Waves } from 'lucide-react'

import { getAccountingKpis } from '@/lib/data/accounting'
import { formatGHS } from '@/lib/utils'

export const metadata: Metadata = { title: 'Accounting' }

export default async function AccountingPage() {
  const kpis = await getAccountingKpis()

  const links = [
    { href: '/accounting/journal',        label: 'Journal Entries',    icon: BookOpen,   desc: 'All double-entry transactions' },
    { href: '/accounting/trial-balance',  label: 'Trial Balance',      icon: Scale,      desc: 'Debit / credit account balances' },
    { href: '/accounting/pnl',            label: 'P&L Statement',      icon: BarChart3,  desc: 'Revenue vs expenses by period' },
    { href: '/accounting/balance-sheet',  label: 'Balance Sheet',      icon: Landmark,   desc: 'Assets, liabilities and equity as at a date' },
    { href: '/accounting/cash-flow',      label: 'Cash Flow',          icon: Waves,      desc: 'Cash movements by source for a period' },
    { href: '/accounting/chart',          label: 'Chart of Accounts',  icon: DollarSign, desc: 'Ghana COA — add or manage accounts' },
    { href: '/accounting/reconcile',      label: 'Bank Reconciliation',icon: GitMerge,   desc: 'Match bank statements to journal lines' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Accounting</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Double-entry ledger · Ghana VAT / NHIL / GETFund / PAYE compliant
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <KpiCard label="MTD Revenue"  value={formatGHS(kpis.mtdRevenue)}  icon={TrendingUp}   color="text-success" />
        <KpiCard label="MTD Expenses" value={formatGHS(kpis.mtdExpenses)} icon={TrendingDown} color="text-danger"  />
        <KpiCard
          label="MTD Net Profit"
          value={formatGHS(kpis.mtdProfit)}
          icon={DollarSign}
          color={kpis.mtdProfit >= 0 ? 'text-success' : 'text-danger'}
        />
        <KpiCard label="YTD Revenue"  value={formatGHS(kpis.ytdRevenue)}  icon={TrendingUp}   color="text-success" />
        <KpiCard label="YTD Expenses" value={formatGHS(kpis.ytdExpenses)} icon={TrendingDown} color="text-danger"  />
        <KpiCard
          label="YTD Net Profit"
          value={formatGHS(kpis.ytdProfit)}
          icon={DollarSign}
          color={kpis.ytdProfit >= 0 ? 'text-success' : 'text-danger'}
        />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {links.map((l) => {
          const Icon = l.icon
          return (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-start gap-4 rounded-xl border border-border bg-surface p-5 hover:bg-surface-raised transition-colors"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                <Icon className="h-5 w-5 text-brand" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">{l.label}</p>
                <p className="mt-0.5 text-xs text-text-secondary">{l.desc}</p>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Ghana tax notice */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm dark:border-amber-800 dark:bg-amber-950/40">
        <p className="font-medium text-amber-800 dark:text-amber-300">Ghana statutory rates applied</p>
        <p className="mt-1 text-amber-700 dark:text-amber-400">
          VAT 15% · NHIL 2.5% · GETFund 2.5% · SSNIT Employee 5.5% · SSNIT Employer 13% · GRA PAYE 2024 bands
        </p>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-secondary">{label}</p>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <p className={`mt-2 text-xl font-bold currency-amount ${color}`}>{value}</p>
    </div>
  )
}
