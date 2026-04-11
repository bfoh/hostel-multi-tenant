import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Edit Asset' }

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: asset }, { data: rooms }] = await Promise.all([
    supabase
      .from('assets')
      .select('id, name, category, description, brand, model, serial_number, room_id, location_note, purchase_date, purchase_price, supplier, warranty_expiry, condition, status, notes')
      .eq('id', id)
      .single(),
    supabase
      .from('rooms')
      .select('id, room_number, block')
      .order('room_number'),
  ])

  if (!asset) notFound()
  const a = asset as any

  // Dynamically import here to keep this a server component
  const { AssetForm } = await import('@/components/assets/asset-form')

  const initial = {
    id:                   a.id,
    name:                 a.name,
    category:             a.category,
    description:          a.description,
    brand:                a.brand,
    model:                a.model,
    serial_number:        a.serial_number,
    room_id:              a.room_id,
    location_note:        a.location_note,
    purchase_date:        a.purchase_date,
    purchase_price_ghs:   a.purchase_price ? (a.purchase_price / 100).toFixed(2) : '',
    supplier:             a.supplier,
    warranty_expiry:      a.warranty_expiry,
    condition:            a.condition,
    status:               a.status,
    notes:                a.notes,
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/assets" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" /> Assets
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="text-sm font-medium text-text-primary">Edit asset</span>
      </div>
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Edit Asset</h1>
        <p className="mt-1 text-sm text-text-secondary">{a.name}</p>
      </div>
      <AssetForm rooms={rooms ?? []} initial={initial} />
    </div>
  )
}
