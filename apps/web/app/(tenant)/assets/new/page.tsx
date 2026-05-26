import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { AssetForm } from '@/components/assets/asset-form'

export const metadata: Metadata = { title: 'Add Asset' }

export default async function NewAssetPage() {
  const supabase = await createTenantAdminClientFromHeaders()
  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, room_number, block')
    .order('room_number')

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/assets" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" /> Assets
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="text-sm font-medium text-text-primary">Add asset</span>
      </div>
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Add Asset</h1>
        <p className="mt-1 text-sm text-text-secondary">A QR code will be auto-generated for printing.</p>
      </div>
      <AssetForm rooms={rooms ?? []} />
    </div>
  )
}
