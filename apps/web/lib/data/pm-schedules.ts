import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { computeNextDue, type PmFrequency, type PmSchedule } from './pm-schedules-shared'

// Re-export pure types + helpers so existing server-side callers can keep
// importing them from '@/lib/data/pm-schedules'. Client components that need
// them must import directly from './pm-schedules-shared' to avoid pulling
// next/headers into the browser bundle.
export type { PmFrequency, PmStatus, PmSchedule } from './pm-schedules-shared'
export { computeNextDue, FREQUENCY_LABELS } from './pm-schedules-shared'

export async function getPmSchedules(filters?: { status?: string }): Promise<PmSchedule[]> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return []

  const supabase = createAdminClient()

  let q = supabase
    .from('pm_schedules')
    .select('*, room:rooms(room_number, block), contractor:contractors(name)')
    .eq('tenant_id', tenantId)
    .order('next_due_date', { ascending: true })

  if (filters?.status && filters.status !== 'all') {
    q = q.eq('status', filters.status)
  }

  const { data } = await q
  return (data ?? []).map(normalise)
}

export async function getPmScheduleById(id: string): Promise<PmSchedule | null> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('pm_schedules')
    .select('*, room:rooms(room_number, block), contractor:contractors(name, phone)')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!data) return null
  return normalise(data)
}

export async function getPmStats() {
  const tenantId = await getServerTenantId()
  if (!tenantId) return { total: 0, active: 0, overdue: 0, dueToday: 0 }

  const supabase = createAdminClient()
  const { data } = await supabase.from('pm_schedules').select('status, next_due_date').eq('tenant_id', tenantId)
  const rows = data ?? []
  const today = new Date().toISOString().slice(0, 10)
  return {
    total:    rows.length,
    active:   rows.filter(r => r.status === 'active').length,
    overdue:  rows.filter(r => r.status === 'active' && r.next_due_date != null && r.next_due_date < today).length,
    dueToday: rows.filter(r => r.status === 'active' && r.next_due_date === today).length,
  }
}

/** Advance next_due_date after a work order is spawned */
export async function advancePmSchedule(id: string) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return

  const supabase = createAdminClient()
  const { data: s } = await supabase
    .from('pm_schedules').select('frequency, interval_value, next_due_date').eq('id', id).eq('tenant_id', tenantId).maybeSingle()
  if (!s || !s.next_due_date) return

  const next = computeNextDue(s.next_due_date, s.frequency as PmFrequency, s.interval_value)
  await (supabase as any).from('pm_schedules').update({ next_due_date: next, last_run_date: s.next_due_date }).eq('id', id).eq('tenant_id', tenantId)
}

function normalise(a: any): PmSchedule {
  return {
    ...a,
    room:       Array.isArray(a.room)       ? (a.room[0]       ?? null) : (a.room       ?? null),
    contractor: Array.isArray(a.contractor) ? (a.contractor[0] ?? null) : (a.contractor ?? null),
  }
}
