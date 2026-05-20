import type { Metadata } from 'next'
import Link from 'next/link'
import { Calculator, History, Settings as SettingsIcon } from 'lucide-react'

import { getDepreciationOverview } from '@/lib/data/depreciation'
import { formatGHS } from '@/lib/utils'
import { DepreciationActions } from '@/components/accounting/depreciation-actions'
import { AssetDepreciationTable } from '@/components/accounting/asset-depreciation-table'

export const metadata: Metadata = { title: 'Depreciation' }

export default async function DepreciationPage() {
  const overview = await getDepreciationOverview()

  if (!overview) {
    return (
      <div className="rounded-xl border border-border bg-surface p-12 text-center">
        <p className="text-sm text-text-secondary">No tenant context.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Asset Depreciation</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Straight-line method · monthly journal posts DR 5100 Depreciation / CR 1510 Accum. Depreciation
          </p>
        </div>
        <Link
          href="/assets"
          className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          <SettingsIcon className="h-3.5 w-3.5" />
          Manage assets
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Total cost"           value={formatGHS(overview.totalCost)}        sublabel={`${overview.activeAssetCount} active asset${overview.activeAssetCount === 1 ? '' : 's'}`} />
        <Kpi label="Accumulated dep."     value={formatGHS(overview.totalAccumulated)} sublabel="Posted to 1510" tone="danger" />
        <Kpi label="Net book value"       value={formatGHS(overview.totalNetBookValue)} sublabel="Cost − accum." tone="brand" />
        <Kpi label="This month's estimate" value={formatGHS(overview.thisMonthEstimate)} sublabel={`${overview.configuredAssetCount} configured`} tone={overview.unconfiguredAssetCount > 0 ? 'warning' : 'neutral'} />
      </div>

      <DepreciationActions
        nextPeriod={overview.nextEligiblePeriod}
        thisMonthEstimate={overview.thisMonthEstimate}
        configuredCount={overview.configuredAssetCount}
        unconfiguredCount={overview.unconfiguredAssetCount}
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Calculator className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-semibold text-text-primary">Assets — inline depreciation config</h2>
          </div>
          <AssetDepreciationTable assets={overview.assets} />
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-semibold text-text-primary">Recent runs</h2>
          </div>
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            {overview.recentRuns.length === 0 ? (
              <p className="px-4 py-6 text-sm text-text-tertiary text-center">No depreciation runs yet.</p>
            ) : (
              <ul className="divide-y divide-border/40">
                {overview.recentRuns.map((r) => {
                  const periodLabel = new Date(r.period_year, r.period_month - 1, 1)
                    .toLocaleDateString('en-GH', { month: 'long', year: 'numeric' })
                  return (
                    <li key={r.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                      <div>
                        <p className="font-medium text-text-primary">{periodLabel}</p>
                        <p className="mt-0.5 text-[11px] text-text-tertiary">
                          {r.asset_count} asset{r.asset_count === 1 ? '' : 's'} · posted {new Date(r.posted_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <p className="font-semibold currency-amount text-text-primary">{formatGHS(r.total_amount)}</p>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Kpi({
  label, value, sublabel, tone,
}: {
  label: string
  value: string
  sublabel?: string
  tone?: 'brand' | 'danger' | 'warning' | 'neutral'
}) {
  const color = {
    brand:   'text-brand',
    danger:  'text-danger',
    warning: 'text-warning',
    neutral: 'text-text-primary',
  }[tone ?? 'neutral']
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={`mt-2 text-xl font-bold currency-amount ${color}`}>{value}</p>
      {sublabel && <p className="mt-1 text-[11px] text-text-tertiary">{sublabel}</p>}
    </div>
  )
}
