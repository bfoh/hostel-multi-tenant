import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { ChevronLeft, Store } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId, getServerBusinessType } from '@/lib/auth/tenant'
import { ListingSettingsForm } from '@/components/settings/listing-settings-form'

export const metadata: Metadata = { title: 'Public Listing' }

export default async function ListingSettingsPage() {
  const tenantId = await getServerTenantId()
  const callerRole = (await headers()).get('x-tenant-role')
  const isHotel = (await getServerBusinessType()) === 'hotel'
  const nounSingular = isHotel ? 'hotel' : 'hostel'

  if (callerRole !== 'owner') {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href="/settings" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" /> Settings
        </Link>
        <div className="rounded-xl border border-border bg-surface p-6 text-sm text-text-secondary">
          Only the {nounSingular} owner can manage the public marketplace listing.
        </div>
      </div>
    )
  }

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
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" /> Settings
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="text-sm font-medium text-text-primary">Public Listing</span>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10">
          <Store className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Public Listing</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Control how your {nounSingular} appears on the GH Hostels marketplace, and how guests pay.
          </p>
        </div>
      </div>

      <ListingSettingsForm
        slug={tenant?.slug ?? ''}
        initialListed={tenant?.listed_publicly ?? true}
        initialPaymentMode={(tenant?.booking_payment_mode as 'online' | 'pay_at_hostel') ?? 'online'}
        initialCity={tenant?.address_city ?? null}
        initialRegion={tenant?.address_region ?? null}
        hasPayoutAccount={!!tenant?.paystack_subaccount_code}
        categories={categories ?? []}
        isHotel={isHotel}
      />
    </div>
  )
}
