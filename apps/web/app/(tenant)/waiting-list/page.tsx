import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { WaitingListClient } from '@/components/waiting-list/waiting-list-client'

export const metadata: Metadata = { title: 'Waiting List' }

export default async function WaitingListPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>
}) {
  const supabase = createAdminClient()
  const headerList = await headers()
  const tenantId = headerList.get('x-tenant-id')
  const initialSource = (await searchParams).source ?? 'all'

  const baseQuery = supabase
    .from('waiting_list')
    .select(`*, room_categories(id, name), occupants(id, first_name, last_name, phone, email)`)
    .not('status', 'in', '("converted","expired","cancelled")')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })

  const scoped = tenantId ? baseQuery.eq('tenant_id', tenantId) : baseQuery

  const [{ data: entries }, { data: categories }] = await Promise.all([
    scoped,
    supabase
      .from('room_categories')
      .select('id, name')
      .order('name'),
  ])

  return (
    <WaitingListClient
      initialEntries={(entries ?? []) as any[]}
      categories={(categories ?? []).map((c) => ({ id: c.id, name: c.name }))}
      initialSource={initialSource}
    />
  )
}
