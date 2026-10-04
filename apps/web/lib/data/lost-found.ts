import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { applySearchTerms, DEFAULT_LIST_PAGE_SIZE, normalisePage } from '@/lib/data/listing'

export type LfStatus = 'unclaimed' | 'claimed' | 'disposed' | 'donated'

export interface LfItem {
  id:             string
  description:    string
  category:       string
  found_date:     string
  found_location: string | null
  image_url:      string | null
  occupant_id:    string | null
  room_id:        string | null
  status:         LfStatus
  claimed_by:     string | null
  claimed_at:     string | null
  notes:          string | null
  created_at:     string
  occupant?: { first_name: string; last_name: string } | null
  room?:    { room_number: string; block: string | null } | null
}

export async function getLfItems(filters?: { status?: string; q?: string }): Promise<LfItem[]> {
  return (await getLfItemsPage(filters)).rows
}

export async function getLfItemsPage(filters?: { status?: string; q?: string; page?: number }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return { rows: [] as LfItem[], total: 0, page: 1, pageSize: DEFAULT_LIST_PAGE_SIZE }

  const supabase = createAdminClient()

  let q = supabase
    .from('lost_found_items')
    .select('*, occupant:occupants(first_name, last_name), room:rooms(room_number, block)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('found_date', { ascending: false })

  if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status)
  q = applySearchTerms(q, ['description', 'category', 'found_location', 'claimed_by', 'notes'], filters?.q)

  const page = normalisePage(filters?.page)
  const offset = (page - 1) * DEFAULT_LIST_PAGE_SIZE
  const { data, count } = await q.range(offset, offset + DEFAULT_LIST_PAGE_SIZE - 1)
  return { rows: (data ?? []).map(normalise), total: count ?? 0, page, pageSize: DEFAULT_LIST_PAGE_SIZE }
}

export async function getLfItemById(id: string): Promise<LfItem | null> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('lost_found_items')
    .select('*, occupant:occupants(first_name, last_name), room:rooms(room_number, block)')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!data) return null
  return normalise(data)
}

export async function getLfStats() {
  const tenantId = await getServerTenantId()
  if (!tenantId) return { unclaimed: 0, claimed: 0, total: 0 }

  const supabase = createAdminClient()
  const { data } = await supabase.from('lost_found_items').select('status').eq('tenant_id', tenantId)
  const rows = data ?? []
  return {
    unclaimed: rows.filter(r => r.status === 'unclaimed').length,
    claimed:   rows.filter(r => r.status === 'claimed').length,
    total:     rows.length,
  }
}

function normalise(a: any): LfItem {
  return {
    ...a,
    occupant: Array.isArray(a.occupant) ? (a.occupant[0] ?? null) : (a.occupant ?? null),
    room:     Array.isArray(a.room)     ? (a.room[0]     ?? null) : (a.room     ?? null),
  }
}
