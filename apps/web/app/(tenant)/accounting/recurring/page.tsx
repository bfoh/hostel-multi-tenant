import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, RefreshCw, Calendar } from 'lucide-react'

import { getRecurringBills, getRecurringJournals } from '@/lib/data/recurring'
import { formatGHS } from '@/lib/utils'
import { RecurringGenerateButton } from '@/components/accounting/recurring-generate-button'
import { DeleteRecurringButton } from '@/components/accounting/delete-recurring-button'

export const metadata: Metadata = { title: 'Recurring Entries' }

const FREQ_LABEL: Record<string, string> = {
  monthly:   'Monthly',
  quarterly: 'Quarterly',
  yearly:    'Yearly',
}

export default async function RecurringPage() {
  const [bills, journals] = await Promise.all([
    getRecurringBills(),
    getRecurringJournals(),
  ])

  const dueBillsCount    = bills.filter((b) => b.isDue).length
  const dueJournalsCount = journals.filter((j) => j.isDue).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Recurring Entries</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Templates that auto-generate bills or journal entries on their schedule
          </p>
        </div>
        <RecurringGenerateButton dueCount={dueBillsCount + dueJournalsCount} />
      </div>

      {/* Recurring bills */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="border-b border-border bg-surface-raised px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Recurring bills</h2>
            <p className="mt-0.5 text-[11px] text-text-tertiary">
              {bills.length} template{bills.length === 1 ? '' : 's'} · {dueBillsCount} due now
            </p>
          </div>
          <Link
            href="/accounting/recurring/bills/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" />
            New template
          </Link>
        </div>
        {bills.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-tertiary">No recurring bills yet. Add one for utilities, rent, internet, etc.</p>
        ) : (
          <table className="w-full">
            <thead className="bg-surface">
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left text-[11px] font-medium text-text-tertiary">Vendor / description</th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-text-tertiary w-24">Freq</th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-text-tertiary w-28">Next run</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-text-tertiary w-32">Amount</th>
                <th className="px-4 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {bills.map((b) => (
                <tr key={b.id} className="hover:bg-surface-raised/50 transition-colors">
                  <td className="px-4 py-2.5">
                    <p className="text-sm text-text-primary">{b.supplier_name ?? b.vendor_name}</p>
                    <p className="mt-0.5 text-[11px] text-text-tertiary truncate max-w-md">{b.description}</p>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-text-secondary">{FREQ_LABEL[b.frequency]}</td>
                  <td className="px-4 py-2.5">
                    <p className="text-xs text-text-primary">
                      {new Date(b.next_run_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </p>
                    {b.isDue && <span className="mt-0.5 inline-block rounded-full bg-warning/10 px-1.5 py-0 text-[10px] font-semibold text-warning">Due</span>}
                    {!b.is_active && <span className="mt-0.5 inline-block rounded-full bg-surface-raised px-1.5 py-0 text-[10px] text-text-tertiary">Paused</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-medium currency-amount text-text-primary tabular-nums">
                    {formatGHS(b.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <DeleteRecurringButton id={b.id} kind="bills" name={b.description} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recurring journals */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="border-b border-border bg-surface-raised px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Recurring journal entries</h2>
            <p className="mt-0.5 text-[11px] text-text-tertiary">
              {journals.length} template{journals.length === 1 ? '' : 's'} · {dueJournalsCount} due now · for prepaid amortization, accruals, etc.
            </p>
          </div>
          <Link
            href="/accounting/recurring/journals/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" />
            New template
          </Link>
        </div>
        {journals.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-tertiary">No recurring journal templates yet.</p>
        ) : (
          <table className="w-full">
            <thead className="bg-surface">
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left text-[11px] font-medium text-text-tertiary">Name</th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-text-tertiary w-24">Freq</th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-text-tertiary w-28">Next run</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-text-tertiary w-24">Lines</th>
                <th className="px-4 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {journals.map((j) => (
                <tr key={j.id} className="hover:bg-surface-raised/50 transition-colors">
                  <td className="px-4 py-2.5">
                    <p className="text-sm text-text-primary">{j.name}</p>
                    <p className="mt-0.5 text-[11px] text-text-tertiary truncate max-w-md">{j.description}</p>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-text-secondary">{FREQ_LABEL[j.frequency]}</td>
                  <td className="px-4 py-2.5">
                    <p className="text-xs text-text-primary">
                      {new Date(j.next_run_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </p>
                    {j.isDue && <span className="mt-0.5 inline-block rounded-full bg-warning/10 px-1.5 py-0 text-[10px] font-semibold text-warning">Due</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums text-text-secondary">{j.lines.length}</td>
                  <td className="px-4 py-2.5 text-right">
                    <DeleteRecurringButton id={j.id} kind="journals" name={j.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface-raised px-5 py-3 text-xs text-text-secondary flex items-start gap-2">
        <Calendar className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-text-primary">How generation works</p>
          <p className="mt-0.5">
            Click "Generate due entries" to fire every active template whose next-run date has passed. Bills land in
            /accounting/ap as <strong>draft</strong> (approve them like any other bill); journal templates post directly.
            After generation, each template advances to its next scheduled run.
          </p>
        </div>
      </div>
    </div>
  )
}
