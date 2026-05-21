import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, CheckCircle2, AlertCircle } from 'lucide-react'

import { getTaxFilings, type TaxFilingKind } from '@/lib/data/tax-filings'
import { formatGHS } from '@/lib/utils'
import { ExportCsvButton } from '@/components/accounting/export-csv-button'

export const metadata: Metadata = { title: 'Tax Filings Register' }

const KIND_LABEL: Record<TaxFilingKind, string> = {
  vat_levies: 'VAT + Levies',
  paye:       'PAYE',
  ssnit:      'SSNIT',
  corporate:  'Corporate Tax',
}

export default async function TaxFilingsRegisterPage() {
  const filings = await getTaxFilings(200)

  const csvRows = filings.map((f) => [
    KIND_LABEL[f.kind] ?? f.kind,
    f.period_year,
    f.period_month ?? '',
    f.due_date,
    f.filed_at ? new Date(f.filed_at).toISOString().slice(0, 10) : '',
    f.amount_due === null ? '' : (f.amount_due / 100).toFixed(2),
    f.reference ?? '',
    f.status,
  ])

  return (
    <div className="space-y-6">
      <div>
        <Link href="/accounting/tax" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Back to Tax
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Tax Filings Register</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Audit history of every filing recorded — GRA receipt numbers, proof of filing, amounts as filed
            </p>
          </div>
          <ExportCsvButton
            filename="tax-filings"
            headers={['Kind', 'Year', 'Month', 'Due date', 'Filed on', 'Amount due (GHS)', 'GRA reference', 'Status']}
            rows={csvRows}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        {filings.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-tertiary">
            No filings recorded yet. Use the "Mark filed" action on a tax return to populate this register.
          </p>
        ) : (
          <table className="w-full min-w-[800px]">
            <thead className="bg-surface-raised">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary w-32">Kind</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary w-32">Period</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary w-28">Due</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary w-28">Filed</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-32">Amount</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary w-32">GRA ref</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary w-24">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filings.map((f) => {
                const periodLabel = f.period_month
                  ? new Date(f.period_year, f.period_month - 1, 1).toLocaleDateString('en-GH', { month: 'short', year: 'numeric' })
                  : `FY ${f.period_year}`
                return (
                  <tr key={f.id} className="hover:bg-surface-raised/50 transition-colors">
                    <td className="px-4 py-2.5 text-sm text-text-primary">{KIND_LABEL[f.kind] ?? f.kind}</td>
                    <td className="px-4 py-2.5 text-sm text-text-secondary">{periodLabel}</td>
                    <td className="px-4 py-2.5 text-xs text-text-secondary">
                      {new Date(f.due_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-text-secondary">
                      {f.filed_at ? new Date(f.filed_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums currency-amount text-text-primary">
                      {f.amount_due !== null ? formatGHS(f.amount_due) : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-text-secondary">{f.reference ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      {f.status === 'filed' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                          <CheckCircle2 className="h-2.5 w-2.5" />Filed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
                          <AlertCircle className="h-2.5 w-2.5" />{f.status}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
