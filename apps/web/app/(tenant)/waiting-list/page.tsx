import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { WaitingListClient } from '@/components/waiting-list/waiting-list-client'

export const metadata: Metadata = { title: 'Waiting List' }

export default async function WaitingListPage() {
  const supabase = createAdminClient()

  const [{ data: entries }, { data: categories }] = await Promise.all([
    supabase
      .from('waiting_list')
      .select(`*, room_categories(id, name), occupants(id, first_name, last_name, phone, email)`)
      .not('status', 'in', '("converted","expired","cancelled")')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true }),
    supabase
      .from('room_categories')
      .select('id, name')
      .order('name'),
  ])

  return (
    <WaitingListClient
      initialEntries={(entries ?? []) as any[]}
      categories={(categories ?? []).map((c) => ({ id: c.id, name: c.name }))}
    />
  )
}
