import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, Pencil, Package } from 'lucide-react'
import { getAssetByQr } from '@/lib/data/assets'
import { formatGHS } from '@/lib/utils'
import { PrintButton } from '@/components/assets/print-button'

export const metadata: Metadata = { title: 'Asset Detail' }

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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <span className="text-xs text-text-secondary shrink-0 w-36">{label}</span>
      <span className="text-sm text-text-primary text-right">{value}</span>
    </div>
  )
}

export default async function AssetQrPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const asset = await getAssetByQr(code)
  if (!asset) notFound()

  const badge   = STATUS_BADGE[asset.status]
  const condCls = CONDITION_BADGE[asset.condition]

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 print:hidden">
        <Link href="/assets" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" /> Assets
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="font-mono text-sm text-text-tertiary">{asset.qr_code}</span>
      </div>

      {/* Header card */}
      <div className="rounded-xl border border-border bg-surface p-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10">
          <Package className="h-8 w-8 text-brand" />
        </div>
        <h1 className="text-xl font-semibold text-text-primary">{asset.name}</h1>
        {(asset.brand || asset.model) && (
          <p className="mt-1 text-sm text-text-secondary">{[asset.brand, asset.model].filter(Boolean).join(' · ')}</p>
        )}
        <div className="mt-3 flex items-center justify-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
          <span className={`text-xs font-medium capitalize ${condCls}`}>{asset.condition}</span>
        </div>
        <p className="mt-3 font-mono text-sm text-text-tertiary">{asset.qr_code}</p>
      </div>

      {/* Details */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Details</h2>
        <Row label="Category"      value={<span className="capitalize">{asset.category}</span>} />
        <Row label="Serial number" value={asset.serial_number} />
        <Row label="Description"   value={asset.description} />
        <Row label="Location"      value={
          asset.room
            ? `Room ${asset.room.room_number}${asset.room.block ? ` · ${asset.room.block}` : ''}`
            : asset.location_note
        } />
        <Row label="Notes" value={asset.notes} />
      </div>

      {/* Purchase info */}
      {(asset.purchase_date || asset.purchase_price || asset.supplier || asset.warranty_expiry) && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-text-primary">Purchase Information</h2>
          <Row label="Purchase date"   value={asset.purchase_date} />
          <Row label="Purchase price"  value={asset.purchase_price ? formatGHS(asset.purchase_price) : null} />
          <Row label="Supplier"        value={asset.supplier} />
          <Row label="Warranty expiry" value={asset.warranty_expiry} />
        </div>
      )}

      {/* Print label */}
      <div className="rounded-xl border border-dashed border-border bg-surface p-5 print:border-solid">
        <h2 className="mb-3 text-sm font-semibold text-text-primary print:hidden">Printable Label</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-base font-bold text-text-primary">{asset.name}</p>
            {(asset.brand || asset.model) && (
              <p className="text-xs text-text-secondary">{[asset.brand, asset.model].filter(Boolean).join(' ')}</p>
            )}
            <p className="mt-1 font-mono text-sm font-semibold text-text-tertiary">{asset.qr_code}</p>
          </div>
          {/* QR code — scan visually represents the code */}
          <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-lg border-2 border-border bg-white p-2 gap-1">
            <div className="grid grid-cols-3 gap-1 w-full">
              <div className="h-5 w-5 rounded-sm border-2 border-black" />
              <div className="h-5 w-full rounded-sm bg-black/10" />
              <div className="h-5 w-5 rounded-sm border-2 border-black" />
            </div>
            <p className="font-mono text-[7px] text-center text-black leading-none break-all">{asset.qr_code}</p>
            <div className="grid grid-cols-3 gap-1 w-full">
              <div className="h-5 w-5 rounded-sm border-2 border-black" />
              <div className="h-5 w-full rounded-sm bg-black/10" />
              <div className="h-5 w-5 rounded-sm bg-black/20" />
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 print:hidden">
        <PrintButton />
        <Link
          href={`/assets/${asset.id}/edit`}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          <Pencil className="h-4 w-4" /> Edit asset
        </Link>
      </div>
    </div>
  )
}
