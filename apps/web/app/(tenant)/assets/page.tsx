import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, QrCode, Package, AlertTriangle, Trash2, Wrench } from 'lucide-react'

import { getAssets, getAssetSummary } from '@/lib/data/assets'
import { formatGHS } from '@/lib/utils'

export const metadata: Metadata = { title: 'Asset Register' }

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

const CATEGORIES = ['all', 'furniture', 'appliance', 'electronics', 'fixture', 'vehicle', 'other', 'general']

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; q?: string }>
}) {
  const { status = 'all', category = 'all', q } = await searchParams

  const [assets, summary] = await Promise.all([
    getAssets({ status, category, search: q }),
    getAssetSummary(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Asset Register</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Track hostel property — furniture, appliances, equipment — with QR codes.
          </p>
        </div>
        <Link
          href="/assets/new"
          className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" /> Add asset
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total assets',   value: summary.total.toString(),       icon: Package,       cls: 'text-text-primary' },
          { label: 'Active',         value: summary.active.toString(),       icon: Package,       cls: 'text-success' },
          { label: 'In maintenance', value: summary.maintenance.toString(),  icon: Wrench,        cls: 'text-warning' },
          { label: 'Total value',    value: formatGHS(summary.totalValue),   icon: Package,       cls: 'text-brand' },
        ].map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs text-text-secondary">{s.label}</p>
              <p className={`mt-1.5 text-lg font-bold currency-amount ${s.cls}`}>{s.value}</p>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search assets…"
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-primary placeholder-text-tertiary focus:border-brand focus:outline-none"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-brand focus:outline-none"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="maintenance">Maintenance</option>
          <option value="disposed">Disposed</option>
          <option value="lost">Lost</option>
        </select>
        <select
          name="category"
          defaultValue={category}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-brand focus:outline-none"
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{c === 'all' ? 'All categories' : c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
        <button type="submit" className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity">
          Filter
        </button>
        {(status !== 'all' || category !== 'all' || q) && (
          <Link href="/assets" className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-raised transition-colors">
            Clear
          </Link>
        )}
      </form>

      {/* Asset list */}
      {assets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-16 text-center">
          <Package className="mx-auto h-10 w-10 text-text-disabled mb-3" />
          <p className="text-sm font-medium text-text-primary">No assets found</p>
          <p className="text-xs text-text-secondary mt-1">Add your first asset to start tracking inventory.</p>
          <Link href="/assets/new" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            <Plus className="h-4 w-4" /> Add first asset
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-raised">
                <tr>
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
                  const badge = STATUS_BADGE[asset.status]
                  const condCls = CONDITION_BADGE[asset.condition]
                  return (
                    <tr key={asset.id} className="hover:bg-surface-raised transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-text-primary">{asset.name}</p>
                        {(asset.brand || asset.model) && (
                          <p className="text-xs text-text-tertiary">{[asset.brand, asset.model].filter(Boolean).join(' ')}</p>
                        )}
                        <span className={`text-[11px] font-medium ${condCls}`}>{asset.condition}</span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary hidden sm:table-cell capitalize">{asset.category}</td>
                      <td className="px-4 py-3 text-text-secondary hidden md:table-cell text-xs">
                        {asset.room ? `Room ${asset.room.room_number}${asset.room.block ? ` · ${asset.room.block}` : ''}` : asset.location_note ?? '—'}
                      </td>
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
      )}
    </div>
  )
}
