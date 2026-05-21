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

  const hasComparison = Boolean(result.priorPeriod)

  const csvHeaders = hasComparison
    ? ['Code', 'Name', 'Type', 'Amount (GHS)', 'Prior (GHS)', 'Delta (GHS)', 'Delta %']
    : ['Code', 'Name', 'Type', 'Amount (GHS)']

  const csvRows: (string | number)[][] = result.rows.map((r) => {
    const base: (string | number)[] = [r.code ?? '', r.name, r.type, (r.amount / 100).toFixed(2)]
    if (hasComparison) {
      base.push(
        ((r.priorAmount ?? 0) / 100).toFixed(2),
        ((r.delta ?? 0) / 100).toFixed(2),
        r.deltaPct === null || r.deltaPct === undefined ? '' : r.deltaPct.toFixed(1),
      )
    }
    return base
  })

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
              {result.priorPeriod && (
                <span className="ml-2 text-text-secondary">vs {result.priorPeriod.from} → {result.priorPeriod.to}</span>
              )}
            </p>
          </div>
          <ExportCsvButton
            filename={report.name.replace(/[^\w-]+/g, '-').toLowerCase()}
            headers={csvHeaders}
            rows={csvRows}
          />
        </div>
      </div>

      {hasComparison && (
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryTile label={result.period.label}      value={formatGHS(result.total)}                      tone="primary" />
          <SummaryTile label={result.priorPeriod!.label} value={formatGHS(result.priorTotal ?? 0)}            tone="muted" />
          <SummaryTile
            label="Change"
            value={formatGHS(Math.abs(result.total - (result.priorTotal ?? 0)))}
            tone={result.total - (result.priorTotal ?? 0) >= 0 ? 'positive' : 'negative'}
            sublabel={(() => {
              const prior = result.priorTotal ?? 0
              if (prior === 0) return null
              const pct = ((result.total - prior) / prior) * 100
              return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs prior`
            })()}
          />
        </div>
      )}

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
                {hasComparison && (
                  <>
                    <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-32">Prior</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-32">Δ</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-24">Δ %</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {result.rows.map((r, idx) => {
                const delta = r.delta ?? 0
                const isRevenue = r.type === 'revenue'
                const isExpense = r.type === 'expense'
                const favorable = isRevenue ? delta >= 0 : isExpense ? delta <= 0 : delta >= 0
                const deltaTone = delta === 0
                  ? 'text-text-tertiary'
                  : favorable
                  ? 'text-success'
                  : 'text-danger'

                const drillHref = r.account_id
                  ? `/accounting/journal?account=${r.account_id}&from=${result.period.from}&to=${result.period.to}`
                  : null
                const NameCell = drillHref
                  ? <Link href={drillHref} className="text-text-primary hover:text-brand transition-colors">{r.name}</Link>
                  : <span className="text-text-primary">{r.name}</span>

                return (
                  <tr key={r.account_id ?? idx} className="hover:bg-surface-raised/50 transition-colors">
                    {result.groupedBy === 'by_account' && (
                      <td className="px-4 py-2.5 font-mono text-xs text-text-tertiary">{r.code ?? '—'}</td>
                    )}
                    <td className="px-4 py-2.5 text-sm">{NameCell}</td>
                    <td className="px-4 py-2.5 text-xs capitalize text-text-secondary">{r.type}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums currency-amount text-text-primary">
                      {drillHref ? (
                        <Link href={drillHref} className="hover:text-brand transition-colors">
                          {formatGHS(r.amount)}
                        </Link>
                      ) : formatGHS(r.amount)}
                    </td>
                    {hasComparison && (
                      <>
                        <td className="px-4 py-2.5 text-right text-sm tabular-nums currency-amount text-text-secondary">
                          {formatGHS(r.priorAmount ?? 0)}
                        </td>
                        <td className={`px-4 py-2.5 text-right text-sm font-medium tabular-nums currency-amount ${deltaTone}`}>
                          {delta === 0 ? '—' : `${delta >= 0 ? '+' : '−'}${formatGHS(Math.abs(delta))}`}
                        </td>
                        <td className={`px-4 py-2.5 text-right text-[11px] tabular-nums ${deltaTone}`}>
                          {r.deltaPct === null || r.deltaPct === undefined
                            ? '—'
                            : `${r.deltaPct >= 0 ? '+' : ''}${r.deltaPct.toFixed(1)}%`}
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface-raised">
                <td colSpan={result.groupedBy === 'by_account' ? 3 : 2} className="px-4 py-3 text-sm font-semibold text-text-primary">
                  Total
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold tabular-nums currency-amount text-text-primary">
                  {formatGHS(result.total)}
                </td>
                {hasComparison && (
                  <>
                    <td className="px-4 py-3 text-right text-sm font-bold tabular-nums currency-amount text-text-secondary">
                      {formatGHS(result.priorTotal ?? 0)}
                    </td>
                    <td className={`px-4 py-3 text-right text-sm font-bold tabular-nums currency-amount ${
                      result.total - (result.priorTotal ?? 0) >= 0 ? 'text-success' : 'text-danger'
                    }`}>
                      {(() => {
                        const d = result.total - (result.priorTotal ?? 0)
                        if (d === 0) return '—'
                        return `${d >= 0 ? '+' : '−'}${formatGHS(Math.abs(d))}`
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right text-[11px] text-text-tertiary"></td>
                  </>
                )}
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}

function SummaryTile({
  label, value, tone, sublabel,
}: {
  label: string
  value: string
  tone: 'primary' | 'muted' | 'positive' | 'negative'
  sublabel?: string | null
}) {
  const color = {
    primary:  'text-text-primary',
    muted:    'text-text-secondary',
    positive: 'text-success',
    negative: 'text-danger',
  }[tone]
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[11px] text-text-tertiary">{label}</p>
      <p className={`mt-1 text-xl font-bold currency-amount ${color}`}>{value}</p>
      {sublabel && <p className="mt-1 text-[11px] text-text-tertiary">{sublabel}</p>}
    </div>
  )
}
