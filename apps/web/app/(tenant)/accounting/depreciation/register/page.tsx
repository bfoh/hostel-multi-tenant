import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, MapPin } from 'lucide-react'

import { getAssetRegister } from '@/lib/data/asset-reports'
import { formatGHS } from '@/lib/utils'
import { ExportCsvButton } from '@/components/accounting/export-csv-button'

export const metadata: Metadata = { title: 'Asset Register' }

const STATUS_TONE: Record<string, string> = {
  active:      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  maintenance: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  disposed:    'bg-surface-raised text-text-tertiary line-through',
  lost:        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}
const CONDITION_TONE: Record<string, string> = {
  excellent: 'text-success',
  good:      'text-text-primary',
  fair:      'text-warning',
  poor:      'text-danger',
}

export default async function AssetRegisterPage() {
  const rows = await getAssetRegister()

  if (!rows) {
    return (
      <div className="rounded-xl border border-border bg-surface p-12 text-center">
        <p className="text-sm text-text-secondary">No tenant context.</p>
      </div>
    )
  }

  const totalCost  = rows.reduce((s, r) => s + (r.purchase_price ?? 0), 0)
  const totalAccum = rows.reduce((s, r) => s + r.accumulated_depreciation, 0)
  const totalNbv   = Math.max(0, totalCost - totalAccum)

  const csvRows = rows.map((r) => [
    r.qr_code,
    r.name,
    r.category,
    r.room ? `${r.room.block ?? ''} ${r.room.room_number}`.trim() : (r.location_note ?? ''),
    r.purchase_date ?? '',
    ((r.purchase_price ?? 0) / 100).toFixed(2),
    (r.salvage_value / 100).toFixed(2),
    r.useful_life_months?.toString() ?? '',
    r.method,
    (r.accumulated_depreciation / 100).toFixed(2),
    (r.netBookValue / 100).toFixed(2),
    r.status,
    r.condition,
  ])

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
            <h1 className="text-xl font-semibold text-text-primary">Asset Register</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Full inventory of capitalized assets with financial position
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/accounting/depreciation/schedule"
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
            >
              Depreciation schedule
            </Link>
            <ExportCsvButton
              filename={`asset-register-${new Date().toISOString().slice(0, 10)}`}
              headers={['QR code', 'Name', 'Category', 'Location', 'Purchase date', 'Cost (GHS)', 'Salvage (GHS)', 'Life (mo)', 'Method', 'Accum. dep. (GHS)', 'Net book (GHS)', 'Status', 'Condition']}
              rows={csvRows}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Total cost"           value={formatGHS(totalCost)}  sublabel={`${rows.length} assets`} />
        <Kpi label="Accumulated dep."     value={formatGHS(totalAccum)} tone="danger" />
        <Kpi label="Total net book value" value={formatGHS(totalNbv)}   tone="brand" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-tertiary">No assets recorded.</p>
        ) : (
          <table className="w-full min-w-[1200px]">
            <thead className="bg-surface-raised">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary w-24">QR</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary">Asset</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary w-32">Location</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary w-28">Purchase</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-28">Cost</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-32">Accum.</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-32">Net book</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary w-24">Status</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary w-24">Condition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-raised/50 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-[11px] text-text-tertiary">{r.qr_code}</td>
                  <td className="px-4 py-2.5">
                    <p className="text-sm text-text-primary">{r.name}</p>
                    <p className="mt-0.5 text-[10px] text-text-tertiary capitalize">{r.category}</p>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-text-secondary">
                    {r.room ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {r.room.block ? `${r.room.block} · ` : ''}{r.room.room_number}
                      </span>
                    ) : r.location_note ? (
                      <span className="text-text-tertiary">{r.location_note}</span>
                    ) : (
                      <span className="text-text-tertiary italic">unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-text-secondary">
                    {r.purchase_date
                      ? new Date(r.purchase_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: '2-digit' })
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm tabular-nums currency-amount text-text-primary">
                    {r.purchase_price ? formatGHS(r.purchase_price) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm tabular-nums currency-amount text-text-secondary">
                    {r.accumulated_depreciation > 0 ? formatGHS(r.accumulated_depreciation) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm tabular-nums currency-amount font-medium text-text-primary">
                    {r.purchase_price ? formatGHS(r.netBookValue) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_TONE[r.status] ?? ''}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className={`px-4 py-2.5 text-xs capitalize ${CONDITION_TONE[r.condition] ?? ''}`}>
                    {r.condition}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface-raised">
                <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-text-primary">Totals</td>
                <td className="px-4 py-3 text-right text-sm font-bold currency-amount text-text-primary">{formatGHS(totalCost)}</td>
                <td className="px-4 py-3 text-right text-sm font-bold currency-amount text-text-secondary">{formatGHS(totalAccum)}</td>
                <td className="px-4 py-3 text-right text-sm font-bold currency-amount text-brand">{formatGHS(totalNbv)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        )}
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
  tone?:    'danger' | 'brand'
}) {
  const color = tone === 'danger' ? 'text-danger' : tone === 'brand' ? 'text-brand' : 'text-text-primary'
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={`mt-2 text-xl font-bold currency-amount ${color}`}>{value}</p>
      {sublabel && <p className="mt-1 text-[11px] text-text-tertiary">{sublabel}</p>}
    </div>
  )
}
