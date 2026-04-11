import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { getJournalEntries } from '@/lib/data/accounting'
import { formatGHS } from '@/lib/utils'

export const metadata: Metadata = { title: 'Journal Entries' }

const SOURCE_LABELS: Record<string, string> = {
  booking_payment:    'Payment',
  payroll:            'Payroll',
  expense:            'Expense',
  refund:             'Refund',
  manual:             'Manual',
  bank_reconciliation:'Bank Rec.',
}

export default async function JournalPage() {
  const entries = await getJournalEntries(100)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/accounting" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" /> Accounting
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="text-sm font-medium text-text-primary">Journal Entries</span>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <p className="text-sm text-text-secondary">No journal entries yet.</p>
          <p className="mt-1 text-xs text-text-tertiary">Entries are auto-created when payments or payroll runs are posted.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => {
            const totalDebit  = entry.lines.reduce((s, l) => s + l.debit,  0)
            return (
              <div key={entry.id} className="rounded-xl border border-border bg-surface">
                {/* Entry header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
                      {SOURCE_LABELS[entry.source] ?? entry.source}
                    </span>
                    <span className="text-sm font-medium text-text-primary">{entry.description}</span>
                    {entry.reference && (
                      <span className="text-xs text-text-tertiary">· {entry.reference}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-text-secondary">
                      {new Date(entry.entry_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="text-sm font-semibold currency-amount text-text-primary">
                      {formatGHS(totalDebit)}
                    </span>
                  </div>
                </div>

                {/* Lines */}
                <div className="divide-y divide-border/50">
                  {entry.lines.map((line) => (
                    <div key={line.id} className="flex items-center px-4 py-2.5 text-sm">
                      <span className="w-16 shrink-0 font-mono text-xs text-text-tertiary">
                        {line.account?.code}
                      </span>
                      <span className="flex-1 text-text-secondary">{line.account?.name}</span>
                      {line.debit  > 0 && (
                        <span className="w-32 text-right currency-amount text-text-primary">
                          {formatGHS(line.debit)}
                        </span>
                      )}
                      {line.credit > 0 && (
                        <span className="w-32 text-right currency-amount text-text-secondary italic">
                          {formatGHS(line.credit)}
                        </span>
                      )}
                      {line.debit === 0 && line.credit === 0 && (
                        <span className="w-32 text-right text-text-disabled">—</span>
                      )}
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
