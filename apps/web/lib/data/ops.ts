import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

export interface ScheduledArrival {
  booking_id:    string
  booking_ref:   string
  occupant_name: string
  room_label:    string
  expected_time: string | null
  status:        string
}

export interface ScheduledDeparture {
  booking_id:    string
  booking_ref:   string
  occupant_name: string
  room_label:    string
  status:        string
  daysOver:      number  // negative if early
}

export interface HkBucket {
  pending:     number
  in_progress: number
  done_today:  number
  urgent_open: number
  list:        Array<{ id: string; room_label: string; status: string; priority: string; due_by: string | null }>
}

export interface MaintBucket {
  open:           number
  in_progress:    number
  done_today:     number
  overdue7d:      number   // open > 7 days
  byPriority:     Record<string, number>
  list:           Array<{ id: string; title: string; room_label: string; status: string; priority: string; created_at: string }>
}

export interface FoodBucket {
  placed_today:    number
  preparing:       number
  ready:           number
  picked_up_today: number
  revenue_today:   number   // pesewas
}

export interface VisitorBucket {
  checked_in_today: number
  currently_inside: number
  list:             Array<{ id: string; name: string; host: string | null; checked_in_at: string }>
}

export interface OpsOverview {
  asOf:        string
  arrivals: {
    today:        ScheduledArrival[]
    yetToCheckIn: number
    checkedInToday: number
  }
  departures: {
    today:               ScheduledDeparture[]
    yetToCheckOut:       number
    checkedOutToday:     number
    overdue:             number
  }
  housekeeping: HkBucket
  maintenance:  MaintBucket
  food:         FoodBucket
  visitors:     VisitorBucket
}

function roomLabel(room: any): string {
  if (!room) return '—'
  return room.block ? `${room.block} · ${room.room_number}` : room.room_number
}

function fullName(occ: any): string {
  if (!occ) return 'Unknown'
  return [occ.first_name, occ.last_name].filter(Boolean).join(' ').trim() || 'Unknown'
}

export async function getOpsOverview(): Promise<OpsOverview | null> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [arrivalsRes, departuresRes, hkRes, maintRes, foodRes, foodToday, visitorsRes] = await Promise.all([
    // Today's expected arrivals (not yet checked in)
    (supabase as any)
      .from('bookings')
      .select('id, booking_ref, status, actual_check_in, occupant:occupants(first_name,last_name), room:rooms(room_number,block)')
      .eq('tenant_id', tenantId)
      .eq('check_in_date', today)
      .in('status', ['confirmed', 'checked_in'])
      .order('booking_ref'),
    // Today's expected departures (currently checked in, leaving today or before)
    (supabase as any)
      .from('bookings')
      .select('id, booking_ref, status, check_out_date, actual_check_out, occupant:occupants(first_name,last_name), room:rooms(room_number,block)')
      .eq('tenant_id', tenantId)
      .lte('check_out_date', today)
      .eq('status', 'checked_in')
      .order('check_out_date'),
    // Housekeeping
    (supabase as any)
      .from('housekeeping_tasks')
      .select('id, status, priority, due_by, completed_at, room:rooms(room_number, block)')
      .eq('tenant_id', tenantId)
      .order('priority', { ascending: true })
      .limit(200),
    // Maintenance
    (supabase as any)
      .from('maintenance_requests')
      .select('id, title, status, priority, created_at, completed_at, room:rooms(room_number, block)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(200),
    // Food orders — open / in progress
    (supabase as any)
      .from('food_orders')
      .select('id, status, total_amount, created_at')
      .eq('tenant_id', tenantId)
      .in('status', ['placed', 'preparing', 'ready'])
      .limit(200),
    // Food orders — today (any status, for daily counters)
    (supabase as any)
      .from('food_orders')
      .select('id, status, total_amount')
      .eq('tenant_id', tenantId)
      .gte('created_at', startOfDay),
    // Visitor logs
    (supabase as any)
      .from('visitor_logs')
      .select('id, visitor_name, host_occupant_id, checked_in_at, checked_out_at, host:occupants(first_name,last_name)')
      .eq('tenant_id', tenantId)
      .gte('checked_in_at', sevenDaysAgo)
      .order('checked_in_at', { ascending: false })
      .limit(200),
  ])

  /* ── Arrivals & departures ──────────────────────────────────────────── */
  const arrivalsRaw = (arrivalsRes?.data ?? []) as any[]
  const arrivals: ScheduledArrival[] = arrivalsRaw
    .filter((b) => !b.actual_check_in)
    .map((b) => ({
      booking_id:    b.id,
      booking_ref:   b.booking_ref,
      occupant_name: fullName(Array.isArray(b.occupant) ? b.occupant[0] : b.occupant),
      room_label:    roomLabel(Array.isArray(b.room) ? b.room[0] : b.room),
      expected_time: null,
      status:        b.status,
    }))
  const checkedInToday = arrivalsRaw.filter((b) => !!b.actual_check_in && String(b.actual_check_in).startsWith(today)).length

  const departuresRaw = (departuresRes?.data ?? []) as any[]
  const departures: ScheduledDeparture[] = departuresRaw
    .filter((b) => !b.actual_check_out)
    .map((b) => {
      const diff = Math.floor((new Date(today).getTime() - new Date(b.check_out_date).getTime()) / (24 * 60 * 60 * 1000))
      return {
        booking_id:    b.id,
        booking_ref:   b.booking_ref,
        occupant_name: fullName(Array.isArray(b.occupant) ? b.occupant[0] : b.occupant),
        room_label:    roomLabel(Array.isArray(b.room) ? b.room[0] : b.room),
        status:        b.status,
        daysOver:      diff,
      }
    })
  const departureOverdue = departures.filter((d) => d.daysOver > 0).length

  /* ── Housekeeping ────────────────────────────────────────────────────── */
  const hkRows = (hkRes?.data ?? []) as any[]
  const hk: HkBucket = {
    pending:     0,
    in_progress: 0,
    done_today:  0,
    urgent_open: 0,
    list:        [],
  }
  for (const t of hkRows) {
    if (t.status === 'pending')      hk.pending += 1
    if (t.status === 'in_progress')  hk.in_progress += 1
    if (t.status === 'done' && t.completed_at && String(t.completed_at).startsWith(today)) hk.done_today += 1
    if (t.priority === 'urgent' && (t.status === 'pending' || t.status === 'in_progress')) hk.urgent_open += 1
    if ((t.status === 'pending' || t.status === 'in_progress') && hk.list.length < 8) {
      hk.list.push({
        id: t.id,
        room_label: roomLabel(Array.isArray(t.room) ? t.room[0] : t.room),
        status:     t.status,
        priority:   t.priority,
        due_by:     t.due_by,
      })
    }
  }

  /* ── Maintenance ─────────────────────────────────────────────────────── */
  const maintRows = (maintRes?.data ?? []) as any[]
  const maint: MaintBucket = {
    open:        0,
    in_progress: 0,
    done_today:  0,
    overdue7d:   0,
    byPriority:  {},
    list:        [],
  }
  for (const m of maintRows) {
    if (m.status === 'open')            maint.open += 1
    if (m.status === 'in_progress')     maint.in_progress += 1
    if (m.status === 'completed' && m.completed_at && String(m.completed_at).startsWith(today)) maint.done_today += 1
    if (m.status !== 'completed' && m.status !== 'cancelled') {
      const ageMs = Date.now() - new Date(m.created_at).getTime()
      if (ageMs > 7 * 24 * 60 * 60 * 1000) maint.overdue7d += 1
      const p = String(m.priority ?? 'normal')
      maint.byPriority[p] = (maint.byPriority[p] ?? 0) + 1
      if (maint.list.length < 8) {
        maint.list.push({
          id:         m.id,
          title:      m.title,
          room_label: roomLabel(Array.isArray(m.room) ? m.room[0] : m.room),
          status:     m.status,
          priority:   p,
          created_at: m.created_at,
        })
      }
    }
  }

  /* ── Food orders ─────────────────────────────────────────────────────── */
  const openOrders   = (foodRes?.data ?? []) as any[]
  const todaysOrders = (foodToday?.data ?? []) as any[]
  const food: FoodBucket = {
    placed_today:    todaysOrders.filter((o) => o.status === 'placed').length,
    preparing:       openOrders.filter((o) => o.status === 'preparing').length,
    ready:           openOrders.filter((o) => o.status === 'ready').length,
    picked_up_today: todaysOrders.filter((o) => o.status === 'picked_up').length,
    revenue_today:   todaysOrders
                       .filter((o) => o.status !== 'cancelled')
                       .reduce((s, o) => s + Number(o.total_amount ?? 0), 0),
  }

  /* ── Visitors ────────────────────────────────────────────────────────── */
  const visRows = (visitorsRes?.data ?? []) as any[]
  const visitors: VisitorBucket = {
    checked_in_today: visRows.filter((v) => String(v.checked_in_at).startsWith(today)).length,
    currently_inside: visRows.filter((v) => !v.checked_out_at).length,
    list:             visRows
      .filter((v) => !v.checked_out_at)
      .slice(0, 8)
      .map((v) => {
        const host = Array.isArray(v.host) ? v.host[0] : v.host
        return {
          id: v.id,
          name: v.visitor_name,
          host: host ? `${host.first_name ?? ''} ${host.last_name ?? ''}`.trim() : null,
          checked_in_at: v.checked_in_at,
        }
      }),
  }

  return {
    asOf: today,
    arrivals: {
      today:          arrivals,
      yetToCheckIn:   arrivals.length,
      checkedInToday,
    },
    departures: {
      today:           departures,
      yetToCheckOut:   departures.filter((d) => d.daysOver === 0).length,
      checkedOutToday: departuresRaw.filter((b) => !!b.actual_check_out && String(b.actual_check_out).startsWith(today)).length,
      overdue:         departureOverdue,
    },
    housekeeping: hk,
    maintenance:  maint,
    food,
    visitors,
  }
}
