import type { Metadata } from 'next'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { MarketingCampaignsClient } from '@/components/marketing/marketing-campaigns-client'

export const metadata: Metadata = { title: 'Marketing' }

async function getAllCampaigns(supabase: Awaited<ReturnType<typeof createTenantAdminClientFromHeaders>>) {
  const rows: any[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data } = await supabase
      .from('marketing_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }
  return rows
}

export default async function MarketingPage() {
  const supabase = await createTenantAdminClientFromHeaders()
  const campaigns = await getAllCampaigns(supabase)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Marketing</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Bulk SMS/email campaigns to your occupants, and a QR code for your public listing
        </p>
      </div>
      <MarketingCampaignsClient initialCampaigns={campaigns as any} />
    </div>
  )
}
