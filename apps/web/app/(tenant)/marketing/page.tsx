import type { Metadata } from 'next'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { MarketingCampaignsClient } from '@/components/marketing/marketing-campaigns-client'

export const metadata: Metadata = { title: 'Marketing' }

export default async function MarketingPage() {
  const supabase = await createTenantAdminClientFromHeaders()
  const { data: campaigns } = await supabase
    .from('marketing_campaigns')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Marketing</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Bulk SMS/email campaigns to your occupants, and a QR code for your public listing
        </p>
      </div>
      <MarketingCampaignsClient initialCampaigns={(campaigns ?? []) as any} />
    </div>
  )
}
