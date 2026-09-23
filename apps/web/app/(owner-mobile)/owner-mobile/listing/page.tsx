import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { ChevronRight, Store, Image as ImageIcon } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { ListingSettingsForm } from '@/components/settings/listing-settings-form'

export const metadata: Metadata = { title: 'Listing · Owner' }
export const dynamic = 'force-dynamic'

export default async function OwnerMobileListingPage() {
  const h        = await headers()
  const tenantId = h.get('x-tenant-id')
  const color    = h.get('x-tenant-color') ?? '#2F7D57'
  const nounSingular = h.get('x-tenant-business-type') === 'hotel' ? 'hotel' : 'hostel'

  const admin = createAdminClient()
  const { data: tenant } = await admin
    .from('tenants')
    .select('slug, listed_publicly, booking_payment_mode, address_city, address_region, paystack_subaccount_code')
    .eq('id', tenantId ?? '')
    .single()

  const { data: categories } = await admin
    .from('room_categories')
    .select('id, name, base_rate, rate_unit')
    .eq('tenant_id', tenantId ?? '')
    .eq('is_active', true)
    .order('sort_order')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Public Listing</h1>
          <p className="mt-0.5 text-xs text-slate-500">How your {nounSingular} appears on the marketplace</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}18` }}>
          <Store className="h-4.5 w-4.5" style={{ color }} />
        </div>
      </div>

      <Link
        href="/rooms/categories"
        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors active:bg-slate-50"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
          <ImageIcon className="h-4.5 w-4.5 text-blue-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">Room types &amp; photos</p>
          <p className="text-xs text-slate-500">Manage rates, availability, and the photos guests see</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <ListingSettingsForm
          slug={tenant?.slug ?? ''}
          initialListed={tenant?.listed_publicly ?? true}
          initialPaymentMode={(tenant?.booking_payment_mode as 'online' | 'pay_at_hostel') ?? 'online'}
          initialCity={tenant?.address_city ?? null}
          initialRegion={tenant?.address_region ?? null}
          hasPayoutAccount={!!tenant?.paystack_subaccount_code}
          categories={categories ?? []}
        />
      </div>
    </div>
  )
}
