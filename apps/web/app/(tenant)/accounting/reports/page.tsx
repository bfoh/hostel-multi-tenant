import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, FileBarChart, ArrowRight } from 'lucide-react'

import { getCustomReports } from '@/lib/data/custom-reports'
import { DeleteReportButton } from '@/components/accounting/delete-report-button'

export const metadata: Metadata = { title: 'Custom Reports' }

const PERIOD_LABEL: Record<string, string> = {
  mtd:        'MTD',
  qtd:        'QTD',
  ytd:        'YTD',
  last_month: 'Last month',
  last_year:  'Last year',
  custom:     'Custom range',
}

export default async function CustomReportsPage() {
  const reports = await getCustomReports()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Custom Reports</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Saved report definitions · account scope + period preset + grouping
          </p>
        </div>
        <Link
          href="/accounting/reports/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          New report
        </Link>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <FileBarChart className="mx-auto h-8 w-8 text-text-tertiary" />
          <p className="mt-3 text-sm text-text-secondary">No custom reports saved yet.</p>
          <Link
            href="/accounting/reports/new"
            className="mt-3 inline-flex items-center gap-1 text-sm text-brand hover:opacity-80 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" />
            Build your first report
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {reports.map((r) => (
            <li key={r.id} className="rounded-xl border border-border bg-surface p-4 hover:bg-surface-raised transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/accounting/reports/${r.id}`} className="block">
                    <p className="text-sm font-semibold text-text-primary">{r.name}</p>
                    {r.description && (
                      <p className="mt-1 text-xs text-text-tertiary line-clamp-2">{r.description}</p>
                    )}
                  </Link>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-brand">
                      {PERIOD_LABEL[r.definition.period.kind] ?? r.definition.period.kind}
                    </span>
                    {r.definition.accountTypes.map((t) => (
                      <span key={t} className="rounded-full bg-surface-raised px-2 py-0.5 capitalize text-text-secondary">
                        {t}
                      </span>
                    ))}
                    <span className="rounded-full bg-surface-raised px-2 py-0.5 text-text-secondary">
                      {r.definition.grouping === 'by_account' ? 'By account' : 'By type'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Link
                    href={`/accounting/reports/${r.id}`}
                    className="inline-flex items-center gap-0.5 rounded-lg bg-brand px-2 py-1 text-[11px] font-medium text-white hover:opacity-90 transition-opacity"
                  >
                    Run <ArrowRight className="h-3 w-3" />
                  </Link>
                  <DeleteReportButton id={r.id} name={r.name} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
