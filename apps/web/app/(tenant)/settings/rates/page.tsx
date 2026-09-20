import type { Metadata } from 'next'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { RateManagementClient } from '@/components/settings/rate-management-client'

export const metadata: Metadata = { title: 'Rate Management' }

export default async function RatesPage() {
  const supabase = await createTenantAdminClientFromHeaders()

  const [
    { data: rates },
    { data: categories },
  ] = await Promise.all([
    supabase
      .from('rate_overrides')
      .select('*, room_categories(id, name)')
      .order('starts_on', { ascending: false }),
    supabase
      .from('room_categories')
      .select('id, name, base_rate')
      .order('name'),
  ])

  return (
    <RateManagementClient
      initialRates={(rates ?? []) as any[]}
      categories={((categories ?? []) as any[]).map((c) => ({ id: c.id, name: c.name, base_rate: c.base_rate ?? 0 }))}
    />
  )
}
