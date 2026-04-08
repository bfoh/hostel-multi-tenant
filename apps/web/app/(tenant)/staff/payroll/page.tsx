import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, DollarSign, Plus } from 'lucide-react'

import { getPayrollRuns } from '@/lib/data/staff'
import { formatGHS, formatDate } from '@/lib/utils'
import { RunPayrollButton } from '@/components/staff/run-payroll-button'

export const metadata: Metadata = { title: 'Payroll' }

const STATUS_STYLES: Record<string, string> = {
  draft:    'bg-surface-sunken text-text-secondary border-border',
  approved: 'bg-brand-subtle text-brand border-brand/20',
  paid:     'bg-success-subtle text-success border-success/20',
}

export default async function PayrollPage() {
  const runs = await getPayrollRuns()

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/staff" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
            <ChevronLeft className="h-4 w-4" /> Staff
          </Link>
          <span className="text-text-disabled">/</span>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Payroll</h1>
            <p className="text-sm text-text-secondary">{runs.length} payroll run{runs.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <RunPayrollButton />
      </div>

      {/* ── Payroll note ─────────────────────────────────────────── */}
      <div className="rounded-lg bg-brand-subtle border border-brand/20 px-4 py-3 text-sm text-brand">
        Payroll uses Ghana GRA 2024 PAYE bands and SSNIT rates (5.5% employee / 13% employer). Net salary = Basic − SSNIT − PAYE.
      </div>

      {/* ── Runs list ────────────────────────────────────────────── */}
      {runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <DollarSign className="h-10 w-10 text-text-disabled" />
          <div>
            <p className="font-medium text-text-primary">No payroll runs yet</p>
            <p className="mt-0.5 text-sm text-text-secondary">
              Run your first payroll to generate payslips for all active staff.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Period</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium text-text-tertiary sm:table-cell">Staff</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary">Total gross</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.map(run => {
                const itemCount = '—'
                return (
                  <tr key={run.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-text-primary">
                        {formatDate(run.period_start)} – {formatDate(run.period_end)}
                      </p>
                      {run.paid_at && (
                        <p className="text-xs text-text-tertiary">Paid {formatDate(run.paid_at)}</p>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell text-sm text-text-secondary">
                      {itemCount} staff
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="currency-amount text-sm font-medium text-text-primary">
                        {formatGHS(run.total_gross ?? 0)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[run.status] ?? 'bg-surface-sunken text-text-secondary border-border'}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/staff/payroll/${run.id}`} className="text-xs text-brand hover:text-brand-hover transition-colors">
                        View →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
