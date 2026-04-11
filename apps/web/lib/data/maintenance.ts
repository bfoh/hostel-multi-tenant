import { createAdminClient } from '@/lib/supabase/admin'

export async function getMaintenanceRequests(filter?: { status?: string; priority?: string }) {
  const supabase = createAdminClient()

  let query = supabase
    .from('maintenance_requests')
    .select('*, room:rooms(room_number, block), contractor:contractors(name, phone)')
    .order('created_at', { ascending: false })

  if (filter?.status && filter.status !== 'all') {
    query = query.eq('status', filter.status as 'open')
  }

  if (filter?.priority && filter.priority !== 'all') {
    query = query.eq('priority', filter.priority as 'low')
  }

  const { data, error } = await query.limit(100)
  if (error) return []
  return data ?? []
}

export async function getMaintenanceById(id: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('maintenance_requests')
    .select('*, room:rooms(room_number, block), contractor:contractors(name, phone, email)')
    .eq('id', id)
    .single()

  if (error) return null
  return data
}

export async function getContractors() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('contractors')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error) return []
  return data ?? []
}

export async function getMaintenanceStats() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('maintenance_requests')
    .select('status, priority')

  if (error || !data) return { open: 0, in_progress: 0, completed: 0, urgent: 0 }

  return {
    open:        data.filter(r => r.status === 'open').length,
    in_progress: data.filter(r => r.status === 'in_progress').length,
    completed:   data.filter(r => r.status === 'completed').length,
    urgent:      data.filter(r => r.priority === 'urgent').length,
  }
}
