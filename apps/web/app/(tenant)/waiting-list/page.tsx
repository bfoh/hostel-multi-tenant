import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { WaitingListClient } from '@/components/waiting-list/waiting-list-client'

export const metadata: Metadata = { title: 'Waiting List' }

export default async function WaitingListPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>
}) {
  const supabase = await createTenantAdminClientFromHeaders()
  const headerList = await headers()
  const tenantId = headerList.get('x-tenant-id')
  const initialSource = (await searchParams).source ?? 'all'

  const [entries, { data: categories }] = await Promise.all([
    getAllWaitingListEntries(supabase, tenantId),
    supabase
      .from('room_categories')
      .select('id, name')
      .order('name'),
  ])

  return (
    <WaitingListClient
      initialEntries={entries as any[]}
      categories={(categories ?? []).map((c) => ({ id: c.id, name: c.name }))}
      initialSource={initialSource}
    />
  )
}

async function getAllWaitingListEntries(supabase: any, tenantId: string | null) {
  const rows: any[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from('waiting_list')
      .select(`*, room_categories(id, name), occupants(id, first_name, last_name, phone, email)`)
      .not('status', 'in', '("converted","expired","cancelled")')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1)
    if (tenantId) query = query.eq('tenant_id', tenantId)
    const { data } = await query
    rows.push(...(data ?? []))
    if ((data ?? []).length < pageSize) break
  }
  return rows
}
