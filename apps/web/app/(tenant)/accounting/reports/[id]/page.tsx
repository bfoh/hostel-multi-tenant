import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { notFound } from 'next/navigation'

import { getCustomReportById, runCustomReport } from '@/lib/data/custom-reports'
import { formatGHS } from '@/lib/utils'
import { ExportCsvButton } from '@/components/accounting/export-csv-button'

export const metadata: Metadata = { title: 'Custom Report' }

export default async function CustomReportRunPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const report = await getCustomReportById(id)
  if (!report) notFound()

  const result = await runCustomReport(report.definition)
  if (!result) notFound()

  const csvRows: (string | number)[][] = result.rows.map((r) => [
    r.code ?? '',
    r.name,
    r.type,
    (r.amount / 100).toFixed(2),
  ])

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/accounting/reports"
          className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to reports
        </Link>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">{report.name}</h1>
            {report.description && (
              <p className="mt-1 text-sm text-text-secondary">{report.description}</p>
            )}
            <p className="mt-1 text-xs text-text-tertiary">
              {result.period.label} · {result.period.from} → {result.period.to}
            </p>
          </div>
          <ExportCsvButton
            filename={report.name.replace(/[^\w-]+/g, '-').toLowerCase()}
            headers={['Code', 'Name', 'Type', 'Amount (GHS)']}
            rows={csvRows}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        {result.rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-tertiary">
            No data matched this report.
          </p>
        ) : (
          <table className="w-full min-w-[600px]">
            <thead className="bg-surface-raised">
              <tr className="border-b border-border">
                {result.groupedBy === 'by_account' && (
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary w-20">Code</th>
                )}
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary">Account / type</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary w-28">Type</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-36">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {result.rows.map((r, idx) => (
                <tr key={r.account_id ?? idx} className="hover:bg-surface-raised/50 transition-colors">
                  {result.groupedBy === 'by_account' && (
                    <td className="px-4 py-2.5 font-mono text-xs text-text-tertiary">{r.code ?? '—'}</td>
                  )}
                  <td className="px-4 py-2.5 text-sm text-text-primary">{r.name}</td>
                  <td className="px-4 py-2.5 text-xs capitalize text-text-secondary">{r.type}</td>
                  <td className="px-4 py-2.5 text-right text-sm tabular-nums currency-amount text-text-primary">
                    {formatGHS(r.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface-raised">
                <td colSpan={result.groupedBy === 'by_account' ? 3 : 2} className="px-4 py-3 text-sm font-semibold text-text-primary">
                  Total
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold tabular-nums currency-amount text-text-primary">
                  {formatGHS(result.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
