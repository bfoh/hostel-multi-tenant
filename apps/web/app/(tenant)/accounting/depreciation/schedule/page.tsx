import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { getDepreciationSchedule } from '@/lib/data/asset-reports'
import { formatGHS } from '@/lib/utils'
import { ExportCsvButton } from '@/components/accounting/export-csv-button'

export const metadata: Metadata = { title: 'Depreciation Schedule' }

export default async function DepreciationSchedulePage() {
  const schedules = await getDepreciationSchedule(24)

  if (!schedules) {
    return (
      <div className="rounded-xl border border-border bg-surface p-12 text-center">
        <p className="text-sm text-text-secondary">No tenant context.</p>
      </div>
    )
  }

  const csvRows: (string | number)[][] = []
  for (const s of schedules) {
    for (const line of s.schedule) {
      csvRows.push([
        s.name,
        s.method,
        line.monthLabel,
        (line.depreciation / 100).toFixed(2),
        (line.cumulative / 100).toFixed(2),
        (line.netBookValue / 100).toFixed(2),
      ])
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/accounting/depreciation"
          className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Depreciation
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Depreciation Schedule</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Forward projection per asset · up to 24 months · uses each asset's configured method
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/accounting/depreciation/register"
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
            >
              Asset register
            </Link>
            <ExportCsvButton
              filename="depreciation-schedule"
              headers={['Asset', 'Method', 'Month', 'Depreciation (GHS)', 'Cumulative (GHS)', 'Net book (GHS)']}
              rows={csvRows}
            />
          </div>
        </div>
      </div>

      {schedules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <p className="text-sm text-text-secondary">No depreciable assets yet.</p>
          <p className="mt-1 text-xs text-text-tertiary">
            Configure useful life + salvage on /accounting/depreciation to populate the schedule.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {schedules.map((s) => (
            <AssetCard key={s.id} schedule={s} />
          ))}
        </div>
      )}
    </div>
  )
}

function AssetCard({
  schedule,
}: {
  schedule: NonNullable<Awaited<ReturnType<typeof getDepreciationSchedule>>>[number]
}) {
  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="border-b border-border bg-surface-raised px-4 py-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">{schedule.name}</p>
          <p className="mt-0.5 text-[11px] text-text-tertiary capitalize">{schedule.category}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-right text-xs sm:grid-cols-5">
          <Cell label="Cost"           value={formatGHS(schedule.purchase_price)} />
          <Cell label="Salvage"        value={formatGHS(schedule.salvage_value)} />
          <Cell label="Accum to date"  value={formatGHS(schedule.accumulatedToDate)} />
          <Cell label="Net book today" value={formatGHS(schedule.netBookToDate)} tone="primary" />
          <Cell
            label="Method"
            value={schedule.method === 'declining_balance' ? `DB ×${schedule.declining_factor.toFixed(1)}` : 'Straight-line'}
          />
        </div>
      </div>

      {schedule.schedule.length === 0 ? (
        <p className="px-4 py-6 text-sm text-text-tertiary text-center">Asset is fully depreciated.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-surface">
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left text-[11px] font-medium text-text-tertiary w-32">Month</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-text-tertiary w-32">Depreciation</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-text-tertiary w-32">Cumulative</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-text-tertiary w-32">Net book</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {schedule.schedule.map((l) => (
                <tr key={l.monthIndex} className="hover:bg-surface-raised/50 transition-colors">
                  <td className="px-4 py-2 text-xs text-text-secondary">{l.monthLabel}</td>
                  <td className="px-4 py-2 text-right text-xs tabular-nums currency-amount text-text-primary">{formatGHS(l.depreciation)}</td>
                  <td className="px-4 py-2 text-right text-xs tabular-nums currency-amount text-text-secondary">{formatGHS(l.cumulative)}</td>
                  <td className="px-4 py-2 text-right text-xs tabular-nums currency-amount text-text-primary">{formatGHS(l.netBookValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-border bg-surface-raised px-4 py-2 text-[11px] text-text-tertiary">
        {schedule.monthsRemaining} month{schedule.monthsRemaining === 1 ? '' : 's'} remaining
        {schedule.fullyDepreciatedAt && (
          <> · fully depreciated {new Date(schedule.fullyDepreciatedAt).toLocaleDateString('en-GH', { month: 'long', year: 'numeric' })}</>
        )}
      </div>
    </div>
  )
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: 'primary' }) {
  return (
    <div>
      <p className="text-[10px] text-text-tertiary">{label}</p>
      <p className={`mt-0.5 text-xs font-semibold tabular-nums ${tone === 'primary' ? 'text-brand' : 'text-text-primary'}`}>
        {value}
      </p>
    </div>
  )
}
