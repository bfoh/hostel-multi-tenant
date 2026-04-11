import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { getChartOfAccounts } from '@/lib/data/accounting'

export const metadata: Metadata = { title: 'Chart of Accounts' }

const TYPE_ORDER = ['asset', 'liability', 'equity', 'revenue', 'expense']
const TYPE_LABELS: Record<string, string> = {
  asset:     'Assets',
  liability: 'Liabilities',
  equity:    'Equity',
  revenue:   'Revenue',
  expense:   'Expenses',
}
const TYPE_COLORS: Record<string, string> = {
  asset:     'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  liability: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  equity:    'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  revenue:   'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  expense:   'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
}

export default async function ChartOfAccountsPage() {
  const accounts = await getChartOfAccounts()

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    label: TYPE_LABELS[type],
    accounts: accounts.filter((a) => a.type === type),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/accounting" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" /> Accounting
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="text-sm font-medium text-text-primary">Chart of Accounts</span>
      </div>

      <div className="space-y-6">
        {grouped.map((group) => (
          <div key={group.type} className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="border-b border-border bg-surface-raised px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-text-primary">{group.label}</span>
              <span className="text-xs text-text-tertiary">{group.accounts.length} accounts</span>
            </div>
            {group.accounts.length === 0 ? (
              <p className="px-4 py-4 text-sm text-text-tertiary">No accounts in this category.</p>
            ) : (
              <div className="divide-y divide-border/40">
                {group.accounts.map((acct) => (
                  <div key={acct.id} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-raised/50 transition-colors">
                    <span className="w-14 shrink-0 font-mono text-xs font-semibold text-text-tertiary">{acct.code}</span>
                    <span className="flex-1 text-sm text-text-primary">{acct.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_COLORS[acct.type]}`}>
                      {group.label}
                    </span>
                    {acct.is_system && (
                      <span className="rounded-full bg-surface-raised border border-border px-2 py-0.5 text-[10px] text-text-tertiary">
                        System
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
