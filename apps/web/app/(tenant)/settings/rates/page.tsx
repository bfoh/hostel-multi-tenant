import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { RateManagementClient } from '@/components/settings/rate-management-client'

export const metadata: Metadata = { title: 'Rate Management' }

export default async function RatesPage() {
  const supabase = createAdminClient()

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
      .select('id, name, base_price')
      .order('name'),
  ])

  return (
    <RateManagementClient
      initialRates={(rates ?? []) as any[]}
      categories={((categories ?? []) as any[]).map((c) => ({ id: c.id, name: c.name, base_price: c.base_price ?? 0 }))}
    />
  )
}
