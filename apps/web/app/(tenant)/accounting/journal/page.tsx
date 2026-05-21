import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'

import { getJournalEntries, getChartOfAccounts } from '@/lib/data/accounting'
import { formatGHS } from '@/lib/utils'
import { JournalFilters } from '@/components/accounting/journal-filters'
import { VoidEntryButton } from '@/components/accounting/void-entry-button'

export const metadata: Metadata = { title: 'Journal Entries' }

const SOURCE_LABELS: Record<string, string> = {
  booking_payment:    'Payment',
  payroll:            'Payroll',
  expense:            'Expense',
  refund:             'Refund',
  manual:             'Manual',
  bank_reconciliation:'Bank Rec.',
}
const SOURCE_BADGE: Record<string, string> = {
  booking_payment:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  payroll:            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  expense:            'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  refund:             'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  manual:             'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  bank_reconciliation:'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; from?: string; to?: string; account?: string }>
}) {
  const sp = await searchParams

  const [entries, accounts] = await Promise.all([
    getJournalEntries(100, 0, {
      source:    sp.source,
      dateFrom:  sp.from,
      dateTo:    sp.to,
      accountId: sp.account,
    }),
    getChartOfAccounts(),
  ])

  const activeAccount = sp.account ? accounts.find((a) => a.id === sp.account) : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Journal Entries</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {activeAccount
              ? <>Entries touching <strong className="text-text-primary">{activeAccount.code} · {activeAccount.name}</strong></>
              : 'All double-entry transactions, newest first'}
          </p>
        </div>
        <Link
          href="/accounting/journal/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          New Entry
        </Link>
      </div>

      <JournalFilters
        accounts={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name }))}
        sources={Object.entries(SOURCE_LABELS).map(([id, label]) => ({ id, label }))}
        activeSource={sp.source}
        activeFrom={sp.from}
        activeTo={sp.to}
        activeAccount={sp.account}
      />

      {entries.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <p className="text-sm text-text-secondary">No journal entries match these filters.</p>
          <p className="mt-1 text-xs text-text-tertiary">
            Entries auto-post when payments, payroll, or expenses are recorded — or add one manually above.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => {
            const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0)
            const isVoided = Boolean(entry.voided_at)
            return (
              <div key={entry.id} className={`rounded-xl border border-border bg-surface overflow-hidden ${isVoided ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${SOURCE_BADGE[entry.source] ?? 'bg-surface-raised text-text-secondary'}`}>
                      {SOURCE_LABELS[entry.source] ?? entry.source}
                    </span>
                    <span className={`text-sm font-medium ${isVoided ? 'line-through text-text-tertiary' : 'text-text-primary'}`}>{entry.description}</span>
                    {entry.reference && (
                      <span className="text-xs text-text-tertiary">· {entry.reference}</span>
                    )}
                    {entry.reverses_entry_id && (
                      <span className="rounded-full bg-warning/10 px-1.5 py-0 text-[10px] font-semibold text-warning">Reversal</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <VoidEntryButton entryId={entry.id} isVoided={isVoided} />
                    <span className="text-xs text-text-secondary">
                      {new Date(entry.entry_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="text-sm font-semibold currency-amount text-text-primary">
                      {formatGHS(totalDebit)}
                    </span>
                  </div>
                </div>

                {isVoided && entry.void_reason && (
                  <div className="border-b border-border bg-danger/5 px-4 py-2 text-[11px] text-danger">
                    Voided: {entry.void_reason}
                  </div>
                )}

                <div className="divide-y divide-border/50">
                  {entry.lines.map((line) => (
                    <div key={line.id} className="flex items-center px-4 py-2.5 text-sm">
                      <span className="w-16 shrink-0 font-mono text-xs text-text-tertiary">
                        {line.account?.code}
                      </span>
                      <span className="flex-1 text-text-secondary">{line.account?.name}</span>
                      <span className={`w-32 text-right currency-amount ${line.debit > 0 ? 'text-text-primary font-medium' : 'text-text-disabled'}`}>
                        {line.debit > 0 ? formatGHS(line.debit) : '—'}
                      </span>
                      <span className={`w-32 text-right currency-amount ${line.credit > 0 ? 'text-text-secondary italic' : 'text-text-disabled'}`}>
                        {line.credit > 0 ? formatGHS(line.credit) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
