import { createClient } from '@/lib/supabase/server'

export async function getVisitorLog(filter?: { date?: string }) {
  const supabase = await createClient()

  let query = supabase
    .from('visitor_log')
    .select('*')
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
  const supabase = await createClient()

  let query = supabase
    .from('incident_reports')
    .select('*')
    .order('occurred_at', { ascending: false })

  if (filter?.severity && filter.severity !== 'all') {
    query = query.eq('severity', filter.severity)
  }

  const { data, error } = await query.limit(100)
  if (error) return []
  return data ?? []
}

export async function getLostFoundItems(filter?: { status?: string }) {
  const supabase = await createClient()

  let query = supabase
    .from('lost_found_items')
    .select('*')
    .order('created_at', { ascending: false })

  if (filter?.status && filter.status !== 'all') {
    query = query.eq('status', filter.status)
  }

  const { data, error } = await query.limit(100)
  if (error) return []
  return data ?? []
}

export async function getSecurityStats() {
  const supabase = await createClient()

  const today = new Date().toISOString().slice(0, 10)

  const [visitors, incidents, lost] = await Promise.all([
    supabase.from('visitor_log').select('id, check_out_at').gte('check_in_at', `${today}T00:00:00`),
    supabase.from('incident_reports').select('id, severity').gte('occurred_at', `${today}T00:00:00`),
    supabase.from('lost_found_items').select('id, status').eq('status', 'unclaimed'),
  ])

  return {
    todayVisitors:     visitors.data?.length ?? 0,
    activeVisitors:    visitors.data?.filter(v => !v.check_out_at).length ?? 0,
    todayIncidents:    incidents.data?.length ?? 0,
    criticalIncidents: incidents.data?.filter(i => i.severity === 'critical').length ?? 0,
    unclaimedItems:    lost.data?.length ?? 0,
  }
}
