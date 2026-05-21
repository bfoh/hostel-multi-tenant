import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { getPayrollRunsList } from '@/lib/data/payroll-register'
import { formatGHS } from '@/lib/utils'

export const metadata: Metadata = { title: 'Payroll Register' }

const STATUS_TONE: Record<string, string> = {
  draft:    'bg-surface-raised text-text-secondary',
  approved: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  paid:     'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300',
}

export default async function PayrollRegisterIndexPage() {
  const runs = await getPayrollRunsList()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Payroll Register</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Statutory-compliant employee-by-employee payroll snapshot per run · feeds GRA PAYE + SSNIT returns
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        {runs.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-tertiary">
            No payroll runs yet. Create one under <Link href="/staff/payroll" className="text-brand hover:opacity-80 transition-opacity">Staff › Payroll</Link>.
          </p>
        ) : (
          <table className="w-full min-w-[600px]">
            <thead className="bg-surface-raised">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary">Period</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary w-24">Status</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-32">Gross pay</th>
                <th className="px-4 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {runs.map((r) => (
                <tr key={r.id} className="hover:bg-surface-raised/50 transition-colors">
                  <td className="px-4 py-2.5">
                    <p className="text-sm text-text-primary">
                      {new Date(r.period_start).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' → '}
                      {new Date(r.period_end).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_TONE[r.status] ?? ''}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm tabular-nums currency-amount text-text-primary">{formatGHS(r.total_gross)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/accounting/payroll/${r.id}`} className="inline-flex items-center gap-0.5 text-xs text-brand hover:opacity-80 transition-opacity">
                      Open <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
