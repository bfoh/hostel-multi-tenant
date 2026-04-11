import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ChevronLeft, Pencil, QrCode, MapPin, Tag, Calendar,
  DollarSign, Wrench, AlertTriangle, CheckCircle, Package,
} from 'lucide-react'

import { getAssets } from '@/lib/data/assets'
import { formatGHS, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const assets = await getAssets()
  const asset = assets.find((a) => a.id === id)
  return { title: asset ? asset.name : 'Asset not found' }
}

const STATUS_STYLES: Record<string, string> = {
  active:      'bg-success-subtle text-success border-success/20',
  maintenance: 'bg-warning-subtle text-warning-fg border-warning/20',
  disposed:    'bg-surface-sunken text-text-secondary border-border',
  lost:        'bg-danger-subtle text-danger border-danger/20',
}

const CONDITION_STYLES: Record<string, string> = {
  excellent: 'bg-success-subtle text-success border-success/20',
  good:      'bg-brand-subtle text-brand border-brand/20',
  fair:      'bg-warning-subtle text-warning-fg border-warning/20',
  poor:      'bg-danger-subtle text-danger border-danger/20',
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border last:border-0">
      <span className="shrink-0 text-xs text-text-tertiary">{label}</span>
      <span className="text-right text-sm text-text-primary">{children}</span>
    </div>
  )
}

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const assets = await getAssets()
  const asset = assets.find((a) => a.id === id)

  if (!asset) notFound()

  const warrantyExpired = asset.warranty_expiry
    ? new Date(asset.warranty_expiry) < new Date()
    : false

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link
            href="/assets"
            className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Assets
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-subtle text-brand">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">{asset.name}</h1>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
                    STATUS_STYLES[asset.status] ?? 'bg-surface-sunken text-text-secondary border-border'
                  }`}
                >
                  {asset.status}
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
                    CONDITION_STYLES[asset.condition] ?? 'bg-surface-sunken text-text-secondary border-border'
                  }`}
                >
                  {asset.condition}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-sunken px-2.5 py-0.5 text-xs text-text-secondary capitalize">
                  <Tag className="h-3 w-3" />
                  {asset.category}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/assets/${id}/edit`}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-raised transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>
        </div>
      </div>

      {/* ── Status alerts ─────────────────────────────────────────── */}
      {asset.status === 'maintenance' && (
        <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning-subtle p-4">
          <Wrench className="h-5 w-5 text-warning-fg shrink-0" />
          <p className="text-sm font-medium text-warning-fg">This asset is currently under maintenance</p>
        </div>
      )}
      {asset.status === 'lost' && (
        <div className="flex items-center gap-3 rounded-xl border border-danger/30 bg-danger-subtle p-4">
          <AlertTriangle className="h-5 w-5 text-danger shrink-0" />
          <p className="text-sm font-medium text-danger">This asset has been reported lost</p>
        </div>
      )}
      {warrantyExpired && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-sunken p-4">
          <AlertTriangle className="h-5 w-5 text-text-disabled shrink-0" />
          <p className="text-sm text-text-secondary">Warranty expired on {new Date(asset.warranty_expiry!).toLocaleDateString()}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Left column ───────────────────────────────────────── */}
        <div className="space-y-4">
          {/* QR Code */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><QrCode className="h-4 w-4" /> QR Code</CardTitle></CardHeader>
            <CardContent className="pt-0 flex flex-col items-center gap-3">
              <div className="rounded-xl border-2 border-border bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(asset.qr_code)}`}
                  alt={`QR code for ${asset.name}`}
                  width={140}
                  height={140}
                  className="block"
                />
              </div>
              <p className="ref-number text-sm text-text-secondary">{asset.qr_code}</p>
              <a
                href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(asset.qr_code)}&format=png`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand hover:underline"
              >
                Download high-res QR →
              </a>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Location</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-1">
              {asset.room ? (
                <p className="text-sm text-text-primary">
                  Room {asset.room.room_number}
                  {asset.room.block ? ` (${asset.room.block})` : ''}
                </p>
              ) : (
                <p className="text-sm text-text-secondary">Not assigned to a room</p>
              )}
              {asset.location_note && (
                <p className="text-xs text-text-tertiary mt-1">{asset.location_note}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right columns ─────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Asset Details */}
          <Card>
            <CardHeader><CardTitle>Asset Details</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {asset.description && (
                <p className="text-sm text-text-secondary mb-4">{asset.description}</p>
              )}
              <div>
                {asset.brand && <Row label="Brand">{asset.brand}</Row>}
                {asset.model && <Row label="Model">{asset.model}</Row>}
                {asset.serial_number && (
                  <Row label="Serial number">
                    <span className="ref-number">{asset.serial_number}</span>
                  </Row>
                )}
                {asset.notes && <Row label="Notes">{asset.notes}</Row>}
              </div>
            </CardContent>
          </Card>

          {/* Purchase Information */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> Purchase Information</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {asset.purchase_price == null && !asset.purchase_date && !asset.supplier ? (
                <p className="text-sm text-text-secondary">No purchase information recorded.</p>
              ) : (
                <div>
                  {asset.purchase_price != null && (
                    <Row label="Purchase price">
                      <span className="currency-amount font-medium">{formatGHS(asset.purchase_price)}</span>
                    </Row>
                  )}
                  {asset.purchase_date && (
                    <Row label="Purchase date">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-text-disabled" />
                        {new Date(asset.purchase_date).toLocaleDateString()}
                      </span>
                    </Row>
                  )}
                  {asset.supplier && <Row label="Supplier">{asset.supplier}</Row>}
                  {asset.warranty_expiry && (
                    <Row label="Warranty expiry">
                      <span className={warrantyExpired ? 'text-danger' : 'text-success'}>
                        {warrantyExpired ? '⚠ ' : '✓ '}
                        {new Date(asset.warranty_expiry).toLocaleDateString()}
                      </span>
                    </Row>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Meta */}
          <Card>
            <CardHeader><CardTitle>Record</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <Row label="Added">{new Date(asset.created_at).toLocaleDateString()}</Row>
              <Row label="Last updated">{new Date(asset.updated_at).toLocaleDateString()}</Row>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
