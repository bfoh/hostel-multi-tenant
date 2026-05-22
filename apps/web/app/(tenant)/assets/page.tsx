import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, QrCode, Package, AlertTriangle, Trash2, Wrench } from 'lucide-react'

import { getAssets, getAssetSummary } from '@/lib/data/assets'
import { formatGHS } from '@/lib/utils'
import { AssetsTable, type AssetRow } from '@/components/assets/assets-table'

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
        <AssetsTable
          assets={assets.map((asset: any): AssetRow => ({
            id:             asset.id,
            name:           asset.name,
            brand:          asset.brand ?? null,
            model:          asset.model ?? null,
            category:       asset.category,
            condition:      asset.condition,
            status:         asset.status,
            locationLabel:  asset.room
              ? `Room ${asset.room.room_number}${asset.room.block ? ` · ${asset.room.block}` : ''}`
              : (asset.location_note ?? '—'),
            purchase_price: asset.purchase_price ?? null,
            qr_code:        asset.qr_code,
          }))}
        />
      )}
    </div>
  )
}
