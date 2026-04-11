import { createAdminClient } from '@/lib/supabase/admin'

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
  const supabase = createAdminClient()

  let q = supabase
    .from('lost_found_items')
    .select('*, occupant:occupants(first_name, last_name), room:rooms(room_number, block)')
    .order('found_date', { ascending: false })

  if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status)
  if (filters?.q) q = q.ilike('description', `%${filters.q}%`)

  const { data } = await q.limit(100)
  return (data ?? []).map(normalise)
}

export async function getLfItemById(id: string): Promise<LfItem | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('lost_found_items')
    .select('*, occupant:occupants(first_name, last_name), room:rooms(room_number, block)')
    .eq('id', id)
    .single()
  if (!data) return null
  return normalise(data)
}

export async function getLfStats() {
  const supabase = createAdminClient()
  const { data } = await supabase.from('lost_found_items').select('status')
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
