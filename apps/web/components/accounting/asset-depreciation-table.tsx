'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'

import { formatGHS } from '@/lib/utils'
import type { DepreciableAsset } from '@/lib/data/depreciation'

export function AssetDepreciationTable({ assets }: { assets: DepreciableAsset[] }) {
  if (assets.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-text-secondary">No active assets — add some from /assets first.</p>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[900px]">
        <thead className="bg-surface-raised">
          <tr className="border-b border-border">
            <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary">Asset</th>
            <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-28">Cost</th>
            <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-24">Life (mo)</th>
            <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-32">Salvage (GHS)</th>
            <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-28">Monthly</th>
            <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-32">Accumulated</th>
            <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-32">Net book</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {assets.map((a) => <Row key={a.id} asset={a} />)}
        </tbody>
      </table>
    </div>
  )
}

function Row({ asset }: { asset: DepreciableAsset }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [life, setLife]       = useState(asset.useful_life_months?.toString() ?? '')
  const [salvage, setSalvage] = useState(((asset.salvage_value ?? 0) / 100).toFixed(2))
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function save() {
    setError(null)
    const lifeNum    = life ? parseInt(life, 10) : null
    const salvageNum = parseFloat(salvage)
    if (lifeNum !== null && (!Number.isInteger(lifeNum) || lifeNum <= 0)) { setError('Life must be a positive integer'); return }
    if (!Number.isFinite(salvageNum) || salvageNum < 0) { setError('Salvage must be ≥ 0'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/accounting/depreciation/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id:           asset.id,
          useful_life_months: lifeNum,
          salvage_value:      Math.round(salvageNum * 100),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? `Failed (${res.status})`); setSaving(false); return }
      setEditing(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className="hover:bg-surface-raised/50 transition-colors">
      <td className="px-4 py-2.5">
        <p className="text-sm text-text-primary">{asset.name}</p>
        <p className="mt-0.5 text-[11px] text-text-tertiary capitalize">{asset.category}</p>
      </td>
      <td className="px-4 py-2.5 text-right text-sm tabular-nums text-text-primary">
        {asset.purchase_price ? formatGHS(asset.purchase_price) : <span className="text-text-tertiary italic">—</span>}
      </td>
      <td className="px-4 py-2.5 text-right">
        {editing ? (
          <input
            type="number"
            min="1"
            step="1"
            value={life}
            onChange={(e) => setLife(e.target.value)}
            disabled={saving}
            placeholder="0"
            className="w-20 rounded-lg border border-brand bg-surface px-2 py-1 text-right text-sm tabular-nums focus:outline-none"
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="rounded-md px-2 py-1 text-sm tabular-nums text-text-primary hover:bg-surface-raised transition-colors">
            {asset.useful_life_months ?? <span className="text-text-tertiary italic">— set —</span>}
          </button>
        )}
      </td>
      <td className="px-4 py-2.5 text-right">
        {editing ? (
          <input
            type="number"
            step="0.01"
            min="0"
            value={salvage}
            onChange={(e) => setSalvage(e.target.value)}
            disabled={saving}
            className="w-24 rounded-lg border border-brand bg-surface px-2 py-1 text-right text-sm tabular-nums focus:outline-none"
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="rounded-md px-2 py-1 text-sm tabular-nums text-text-primary hover:bg-surface-raised transition-colors">
            {formatGHS(asset.salvage_value ?? 0)}
          </button>
        )}
        {error && <p className="mt-1 text-[10px] text-danger">{error}</p>}
      </td>
      <td className="px-4 py-2.5 text-right text-sm tabular-nums text-text-secondary">
        {asset.monthlyDepreciation > 0 ? formatGHS(asset.monthlyDepreciation) : '—'}
        {editing && (
          <div className="mt-1 flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              aria-label="Save"
              className="rounded-lg bg-brand p-1.5 text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setError(null) }}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-[10px] text-text-secondary hover:bg-surface-raised transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </td>
      <td className="px-4 py-2.5 text-right text-sm tabular-nums text-text-secondary">
        {asset.accumulated_depreciation > 0 ? formatGHS(asset.accumulated_depreciation) : '—'}
      </td>
      <td className="px-4 py-2.5 text-right text-sm tabular-nums font-medium text-text-primary">
        {asset.purchase_price ? formatGHS(asset.netBookValue) : '—'}
        {asset.isFullyDepreciated && (
          <p className="mt-0.5 text-[10px] text-text-tertiary italic">fully depreciated</p>
        )}
      </td>
    </tr>
  )
}
