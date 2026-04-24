/**
 * Pure types + helpers for preventive-maintenance schedules.
 *
 * This file intentionally avoids `next/headers` or any server-only imports so
 * it can be pulled into client components (e.g. the PM schedule form) without
 * contaminating the browser bundle with server APIs.
 */

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
