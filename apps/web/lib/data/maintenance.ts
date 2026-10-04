import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { applySearchTerms, DEFAULT_LIST_PAGE_SIZE, normalisePage } from '@/lib/data/listing'

export async function getMaintenanceRequestsPage(filter?: { status?: string; priority?: string; search?: string; page?: number }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return { rows: [], total: 0, page: 1, pageSize: DEFAULT_LIST_PAGE_SIZE }

  const supabase = createAdminClient()

  let query = supabase
    .from('maintenance_requests')
    .select('*, room:rooms(room_number, block), contractor:contractors(name, phone)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (filter?.status && filter.status !== 'all') {
    query = query.eq('status', filter.status as 'open')
  }

  if (filter?.priority && filter.priority !== 'all') {
    query = query.eq('priority', filter.priority as 'low')
  }

  query = applySearchTerms(
    query,
    ['ref_number', 'title', 'description', 'notes', 'source', 'reported_by'],
    filter?.search,
  )

  const page = normalisePage(filter?.page)
  const offset = (page - 1) * DEFAULT_LIST_PAGE_SIZE
  const { data, error, count } = await query.range(offset, offset + DEFAULT_LIST_PAGE_SIZE - 1)
  if (error) return { rows: [], total: 0, page, pageSize: DEFAULT_LIST_PAGE_SIZE }
  return { rows: data ?? [], total: count ?? 0, page, pageSize: DEFAULT_LIST_PAGE_SIZE }
}

export async function getMaintenanceRequests(filter?: { status?: string; priority?: string; search?: string }) {
  return (await getMaintenanceRequestsPage(filter)).rows
}

export async function getMaintenanceById(id: string) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('maintenance_requests')
    .select('*, room:rooms(room_number, block), contractor:contractors(name, phone, email)')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) return null
  return data
}

export async function getContractors() {
  const tenantId = await getServerTenantId()
  if (!tenantId) return []

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('contractors')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name')

  if (error) return []
  return data ?? []
}

export async function getMaintenanceStats() {
  const tenantId = await getServerTenantId()
  if (!tenantId) return { open: 0, in_progress: 0, completed: 0, urgent: 0 }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('maintenance_requests')
    .select('status, priority')
    .eq('tenant_id', tenantId)

  if (error || !data) return { open: 0, in_progress: 0, completed: 0, urgent: 0 }

  return {
    open:        data.filter(r => r.status === 'open').length,
    in_progress: data.filter(r => r.status === 'in_progress').length,
    completed:   data.filter(r => r.status === 'completed').length,
    urgent:      data.filter(r => r.priority === 'urgent').length,
  }
}
