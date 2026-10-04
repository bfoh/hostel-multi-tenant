import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { applySearchTerms, DEFAULT_LIST_PAGE_SIZE, normalisePage } from '@/lib/data/listing'

export async function getVisitorLogPage(filter?: { date?: string; search?: string; page?: number }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return { rows: [], total: 0, page: 1, pageSize: DEFAULT_LIST_PAGE_SIZE }

  const supabase = createAdminClient()

  let query = supabase
    .from('visitor_log')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('check_in_at', { ascending: false })

  if (filter?.date) {
    query = query
      .gte('check_in_at', `${filter.date}T00:00:00`)
      .lte('check_in_at', `${filter.date}T23:59:59`)
  }

  query = applySearchTerms(query, ['visitor_name', 'visitor_phone', 'host_name', 'room_number', 'vehicle_plate', 'notes'], filter?.search)
  const page = normalisePage(filter?.page)
  const offset = (page - 1) * DEFAULT_LIST_PAGE_SIZE
  const { data, error, count } = await query.range(offset, offset + DEFAULT_LIST_PAGE_SIZE - 1)
  if (error) return { rows: [], total: 0, page, pageSize: DEFAULT_LIST_PAGE_SIZE }
  return { rows: data ?? [], total: count ?? 0, page, pageSize: DEFAULT_LIST_PAGE_SIZE }
}

export async function getVisitorLog(filter?: { date?: string; search?: string }) {
  return (await getVisitorLogPage(filter)).rows
}

export async function getIncidentReportsPage(filter?: { severity?: string; search?: string; page?: number }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return { rows: [], total: 0, page: 1, pageSize: DEFAULT_LIST_PAGE_SIZE }

  const supabase = createAdminClient()

  let query = supabase
    .from('incident_reports')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('occurred_at', { ascending: false })

  if (filter?.severity && filter.severity !== 'all') {
    query = query.eq('severity', filter.severity as 'low')
  }

  query = applySearchTerms(
    query,
    ['ref_number', 'title', 'description', 'location', 'involved_parties', 'action_taken', 'police_ref'],
    filter?.search,
  )
  const page = normalisePage(filter?.page)
  const offset = (page - 1) * DEFAULT_LIST_PAGE_SIZE
  const { data, error, count } = await query.range(offset, offset + DEFAULT_LIST_PAGE_SIZE - 1)
  if (error) return { rows: [], total: 0, page, pageSize: DEFAULT_LIST_PAGE_SIZE }
  return { rows: data ?? [], total: count ?? 0, page, pageSize: DEFAULT_LIST_PAGE_SIZE }
}

export async function getIncidentReports(filter?: { severity?: string; search?: string }) {
  return (await getIncidentReportsPage(filter)).rows
}

export async function getLostFoundItemsPage(filter?: { status?: string; search?: string; page?: number }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return { rows: [], total: 0, page: 1, pageSize: DEFAULT_LIST_PAGE_SIZE }

  const supabase = createAdminClient()

  let query = supabase
    .from('lost_found_items')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (filter?.status && filter.status !== 'all') {
    query = query.eq('status', filter.status as 'unclaimed')
  }

  query = applySearchTerms(
    query,
    ['item_name', 'description', 'owner_name', 'owner_phone', 'location_found', 'room_number'],
    filter?.search,
  )
  const page = normalisePage(filter?.page)
  const offset = (page - 1) * DEFAULT_LIST_PAGE_SIZE
  const { data, error, count } = await query.range(offset, offset + DEFAULT_LIST_PAGE_SIZE - 1)
  if (error) return { rows: [], total: 0, page, pageSize: DEFAULT_LIST_PAGE_SIZE }
  return { rows: data ?? [], total: count ?? 0, page, pageSize: DEFAULT_LIST_PAGE_SIZE }
}

export async function getLostFoundItems(filter?: { status?: string; search?: string }) {
  return (await getLostFoundItemsPage(filter)).rows
}

export async function getSecurityStats() {
  const tenantId = await getServerTenantId()
  if (!tenantId) return { todayVisitors: 0, activeVisitors: 0, todayIncidents: 0, criticalIncidents: 0, unclaimedItems: 0 }

  const supabase = createAdminClient()

  const today = new Date().toISOString().slice(0, 10)

  const [visitors, incidents, lost] = await Promise.all([
    supabase.from('visitor_log').select('id, check_out_at').eq('tenant_id', tenantId).gte('check_in_at', `${today}T00:00:00`),
    supabase.from('incident_reports').select('id, severity').eq('tenant_id', tenantId).gte('occurred_at', `${today}T00:00:00`),
    supabase.from('lost_found_items').select('id, status').eq('tenant_id', tenantId).eq('status', 'unclaimed'),
  ])

  return {
    todayVisitors:     visitors.data?.length ?? 0,
    activeVisitors:    visitors.data?.filter(v => !v.check_out_at).length ?? 0,
    todayIncidents:    incidents.data?.length ?? 0,
    criticalIncidents: incidents.data?.filter(i => i.severity === 'critical').length ?? 0,
    unclaimedItems:    lost.data?.length ?? 0,
  }
}
