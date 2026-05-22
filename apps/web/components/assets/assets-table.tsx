'use client'

import Link from 'next/link'
import { QrCode } from 'lucide-react'

import { formatGHS } from '@/lib/utils'
import { useBulkSelect, BulkActionBar } from '@/components/ui/bulk-select'

export interface AssetRow {
  id:             string
  name:           string
  brand:          string | null
  model:          string | null
  category:       string
  condition:      string
  status:         string
  locationLabel:  string
  purchase_price: number | null
  qr_code:        string
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active:      { label: 'Active',      cls: 'bg-success/10 text-success' },
  maintenance: { label: 'Maintenance', cls: 'bg-warning/10 text-warning' },
  disposed:    { label: 'Disposed',    cls: 'bg-surface-raised text-text-tertiary' },
  lost:        { label: 'Lost',        cls: 'bg-danger/10 text-danger' },
}
const CONDITION_BADGE: Record<string, string> = {
  excellent: 'text-success',
  good:      'text-info',
  fair:      'text-warning',
  poor:      'text-danger',
}

export function AssetsTable({ assets }: { assets: AssetRow[] }) {
  const bulk = useBulkSelect(assets.map((a) => a.id))

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <BulkActionBar bulk={bulk} resource="assets" itemNoun="asset" />
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-raised">
              <tr>
                {bulk.selectMode && (
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={bulk.allSelected}
                      onChange={bulk.toggleAll}
                      className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                      aria-label="Select all"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Asset</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary hidden sm:table-cell">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary hidden md:table-cell">Location</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary hidden lg:table-cell">Value</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">QR</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {assets.map((asset) => {
                const badge = STATUS_BADGE[asset.status] ?? { label: asset.status, cls: 'bg-surface-raised text-text-tertiary' }
                const condCls = CONDITION_BADGE[asset.condition] ?? 'text-text-tertiary'
                return (
                  <tr key={asset.id} className="hover:bg-surface-raised transition-colors">
                    {bulk.selectMode && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={bulk.isSelected(asset.id)}
                          onChange={() => bulk.toggle(asset.id)}
                          className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-primary">{asset.name}</p>
                      {(asset.brand || asset.model) && (
                        <p className="text-xs text-text-tertiary">{[asset.brand, asset.model].filter(Boolean).join(' ')}</p>
                      )}
                      <span className={`text-[11px] font-medium ${condCls}`}>{asset.condition}</span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary hidden sm:table-cell capitalize">{asset.category}</td>
                    <td className="px-4 py-3 text-text-secondary hidden md:table-cell text-xs">{asset.locationLabel}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 currency-amount text-text-secondary hidden lg:table-cell">
                      {asset.purchase_price ? formatGHS(asset.purchase_price) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/assets/qr/${asset.qr_code}`}
                        className="flex items-center gap-1 text-xs text-brand hover:underline font-mono"
                      >
                        <QrCode className="h-3 w-3" />
                        {asset.qr_code}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/assets/${asset.id}/edit`} className="text-xs text-brand hover:underline">
                        Edit
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
