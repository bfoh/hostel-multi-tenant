import { createAdminClient } from '@/lib/supabase/admin'

export type PmFrequency = 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'biannual' | 'annual'
export type PmStatus    = 'active' | 'paused' | 'archived'

export interface PmSchedule {
  id:                    string
  title:                 string
  description:           string | null
  category:              string
  room_id:               string | null
  location_note:         string | null
  frequency:             PmFrequency
  interval_value:        number
  start_date:            string
  next_due_date:         string
  last_run_date:         string | null
  default_priority:      string
  default_contractor_id: string | null
  estimated_cost_ghs:    number | null
  status:                PmStatus
  notes:                 string | null
  created_at:            string
  updated_at:            string
  room?:                 { room_number: string; block: string | null } | null
  contractor?:           { name: string } | null
}

export async function getPmSchedules(filters?: { status?: string }): Promise<PmSchedule[]> {
  const supabase = createAdminClient()

  let q = supabase
    .from('pm_schedules')
    .select('*, room:rooms(room_number, block), contractor:contractors(name)')
    .order('next_due_date', { ascending: true })

  if (filters?.status && filters.status !== 'all') {
    q = q.eq('status', filters.status)
  }

  const { data } = await q
  return (data ?? []).map(normalise)
}

export async function getPmScheduleById(id: string): Promise<PmSchedule | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('pm_schedules')
    .select('*, room:rooms(room_number, block), contractor:contractors(name, phone)')
    .eq('id', id)
    .single()
  if (!data) return null
  return normalise(data)
}

export async function getPmStats() {
  const supabase = createAdminClient()
  const { data } = await supabase.from('pm_schedules').select('status, next_due_date')
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
  const supabase = createAdminClient()
  const { data: s } = await supabase
    .from('pm_schedules').select('frequency, interval_value, next_due_date').eq('id', id).single()
  if (!s || !s.next_due_date) return

  const next = computeNextDue(s.next_due_date, s.frequency as PmFrequency, s.interval_value)
  await (supabase as any).from('pm_schedules').update({ next_due_date: next, last_run_date: s.next_due_date }).eq('id', id)
}

export function computeNextDue(from: string, freq: PmFrequency, interval: number): string {
  const d = new Date(from)
  switch (freq) {
    case 'daily':       d.setDate(d.getDate()      + interval);        break
    case 'weekly':      d.setDate(d.getDate()      + interval * 7);    break
    case 'fortnightly': d.setDate(d.getDate()      + interval * 14);   break
    case 'monthly':     d.setMonth(d.getMonth()    + interval);        break
    case 'quarterly':   d.setMonth(d.getMonth()    + interval * 3);    break
    case 'biannual':    d.setMonth(d.getMonth()    + interval * 6);    break
    case 'annual':      d.setFullYear(d.getFullYear() + interval);     break
  }
  return d.toISOString().slice(0, 10)
}

export const FREQUENCY_LABELS: Record<PmFrequency, string> = {
  daily:       'Daily',
  weekly:      'Weekly',
  fortnightly: 'Fortnightly',
  monthly:     'Monthly',
  quarterly:   'Quarterly',
  biannual:    'Bi-annual',
  annual:      'Annual',
}

function normalise(a: any): PmSchedule {
  return {
    ...a,
    room:       Array.isArray(a.room)       ? (a.room[0]       ?? null) : (a.room       ?? null),
    contractor: Array.isArray(a.contractor) ? (a.contractor[0] ?? null) : (a.contractor ?? null),
  }
}
