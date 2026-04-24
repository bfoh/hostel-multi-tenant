import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

export async function getVisitorLog(filter?: { date?: string }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return []

  const supabase = createAdminClient()

  let query = supabase
    .from('visitor_log')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('check_in_at', { ascending: false })

  if (filter?.date) {
    query = query
      .gte('check_in_at', `${filter.date}T00:00:00`)
      .lte('check_in_at', `${filter.date}T23:59:59`)
  }

  const { data, error } = await query.limit(100)
  if (error) return []
  return data ?? []
}

export async function getIncidentReports(filter?: { severity?: string }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return []

  const supabase = createAdminClient()

  let query = supabase
    .from('incident_reports')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('occurred_at', { ascending: false })

  if (filter?.severity && filter.severity !== 'all') {
    query = query.eq('severity', filter.severity as 'low')
  }

  const { data, error } = await query.limit(100)
  if (error) return []
  return data ?? []
}

export async function getLostFoundItems(filter?: { status?: string }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return []

  const supabase = createAdminClient()

  let query = supabase
    .from('lost_found_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (filter?.status && filter.status !== 'all') {
    query = query.eq('status', filter.status as 'unclaimed')
  }

  const { data, error } = await query.limit(100)
  if (error) return []
  return data ?? []
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
