import type { Metadata } from 'next'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { LocalGuideClient } from '@/components/settings/local-guide-client'

export const metadata: Metadata = { title: 'Local Guide' }

export default async function LocalGuidePage() {
  const supabase = await createTenantAdminClientFromHeaders()
  const { data: entries } = await supabase
    .from('tenant_local_guide_entries')
    .select('*')
    .order('sort_order')
    .order('created_at')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Local Guide</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Restaurants, attractions, and practical info for guests during their stay
        </p>
      </div>
      <LocalGuideClient initialEntries={(entries ?? []) as any} />
    </div>
  )
}
