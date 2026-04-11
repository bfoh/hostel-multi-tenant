import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  BedDouble, ClipboardList, Wrench, Users,
  CheckCircle2, Clock, AlertCircle, CalendarCheck,
} from 'lucide-react'

export const metadata: Metadata = { title: 'Staff Portal' }

async function getStaffDashboardData(tenantId: string, staffUserId: string) {
  const supabase = await createClient()

  const [
    { data: tasks },
    { data: maintenance },
    { data: todayCheckins },
    { data: todayCheckouts },
    { data: staffRecord },
  ] = await Promise.all([
    // Housekeeping tasks assigned to this staff member
    supabase
      .from('housekeeping_tasks')
      .select('id, room_id, status, priority, notes, due_date, rooms(room_number, block)')
      .eq('tenant_id', tenantId)
      .eq('assigned_to', staffUserId)
      .neq('status', 'done')
      .order('priority', { ascending: false })
      .limit(20),

    // Open maintenance requests for this tenant
    supabase
      .from('maintenance_requests')
      .select('id, title, category, priority, status, created_at, rooms(room_number)')
      .eq('tenant_id', tenantId)
      .in('status', ['open', 'in_progress'])
      .order('priority', { ascending: false })
      .limit(20),

    // Today's check-ins
    supabase
      .from('bookings')
      .select('id, booking_ref, check_in_date, occupants(first_name, last_name), rooms(room_number)')
      .eq('tenant_id', tenantId)
      .eq('check_in_date', new Date().toISOString().split('T')[0])
      .eq('status', 'confirmed')
      .limit(10),

    // Today's check-outs
    supabase
      .from('bookings')
      .select('id, booking_ref, check_out_date, occupants(first_name, last_name), rooms(room_number)')
      .eq('tenant_id', tenantId)
      .eq('check_out_date', new Date().toISOString().split('T')[0])
      .eq('status', 'checked_in')
      .limit(10),

    // This staff member's record
    supabase
      .from('staff_profiles')
      .select('id, first_name, last_name, job_title, department')
      .eq('tenant_id', tenantId)
      .eq('user_id', staffUserId)
      .single(),
  ])

  return { tasks, maintenance, todayCheckins, todayCheckouts, staffRecord }
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'text-red-600 bg-red-50 border-red-200',
  high:   'text-orange-600 bg-orange-50 border-orange-200',
  medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  low:    'text-slate-500 bg-slate-50 border-slate-200',
}

const STATUS_COLOR: Record<string, string> = {
  open:        'text-red-600 bg-red-50',
  in_progress: 'text-blue-600 bg-blue-50',
  pending:     'text-yellow-600 bg-yellow-50',
  done:        'text-green-600 bg-green-50',
}

export default async function StaffPortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) redirect('/login')

  const { tasks, maintenance, todayCheckins, todayCheckouts, staffRecord } =
    await getStaffDashboardData(tenantId, user.id)

  const today = new Date().toLocaleDateString('en-GH', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-6">

      {/* Greeting */}
      <div>
        <p className="text-sm text-slate-500">{today}</p>
        <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
          {staffRecord ? `Hello, ${staffRecord.first_name} 👋` : 'Staff Dashboard'}
        </h1>
        {staffRecord && (
          <p className="text-sm text-slate-500 mt-0.5 capitalize">
            {staffRecord.job_title ?? staffRecord.department ?? 'Staff'}
          </p>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'My Tasks',       value: tasks?.length ?? 0,          icon: ClipboardList, color: 'bg-blue-500' },
          { label: 'Open Requests',  value: maintenance?.length ?? 0,     icon: Wrench,        color: 'bg-orange-500' },
          { label: "Today's Check-ins",  value: todayCheckins?.length ?? 0,  icon: CalendarCheck, color: 'bg-green-500' },
          { label: "Today's Check-outs", value: todayCheckouts?.length ?? 0, icon: BedDouble,     color: 'bg-purple-500' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
            <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ${s.color}`}>
              <s.icon className="h-4 w-4 text-white" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* My Housekeeping Tasks */}
        <section className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-blue-500" />
              My Tasks
            </h2>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
              {tasks?.length ?? 0} pending
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {!tasks?.length ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-400" />
                <p className="text-sm text-slate-500">All clear! No pending tasks.</p>
              </div>
            ) : (
              (tasks as any[]).map((task) => {
                const room = Array.isArray(task.rooms) ? task.rooms[0] : task.rooms
                return (
                  <div key={task.id} className="flex items-start gap-3 px-5 py-3.5">
                    <div className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${PRIORITY_COLOR[task.priority as string] ?? PRIORITY_COLOR.low}`}>
                      {task.priority}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">
                        Room {room?.room_number ?? '—'}{room?.block ? ` (${room.block})` : ''}
                      </p>
                      {task.notes && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{task.notes}</p>}
                      {task.due_date && (
                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Due {new Date(task.due_date as string).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${STATUS_COLOR[task.status as string] ?? ''}`}>
                      {task.status}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* Maintenance Requests */}
        <section className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Wrench className="h-4 w-4 text-orange-500" />
              Open Maintenance
            </h2>
            <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-600">
              {maintenance?.length ?? 0} open
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {!maintenance?.length ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-400" />
                <p className="text-sm text-slate-500">No open maintenance requests.</p>
              </div>
            ) : (
              (maintenance as any[]).map((req) => {
                const room = Array.isArray(req.rooms) ? req.rooms[0] : req.rooms
                return (
                  <div key={req.id} className="flex items-start gap-3 px-5 py-3.5">
                    <AlertCircle className={`mt-0.5 h-4 w-4 shrink-0 ${req.priority === 'urgent' ? 'text-red-500' : req.priority === 'high' ? 'text-orange-500' : 'text-slate-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 line-clamp-1">{req.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 capitalize">
                        {req.category?.replace('_', ' ')} · Room {room?.room_number ?? '—'}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${STATUS_COLOR[req.status as string] ?? ''}`}>
                      {req.status?.replace('_', ' ')}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* Today's Check-ins */}
        <section className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-green-500" />
              Today&apos;s Check-ins
            </h2>
            <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-600">
              {todayCheckins?.length ?? 0}
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {!todayCheckins?.length ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">No check-ins today.</p>
            ) : (
              todayCheckins.map((b) => {
                const occ  = Array.isArray(b.occupants) ? b.occupants[0] : b.occupants
                const room = Array.isArray(b.rooms)     ? b.rooms[0]     : b.rooms
                return (
                  <div key={b.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {occ?.first_name} {occ?.last_name}
                      </p>
                      <p className="text-xs text-slate-400 font-mono">{b.booking_ref}</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-700">
                      Room {room?.room_number ?? '—'}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* Today's Check-outs */}
        <section className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <BedDouble className="h-4 w-4 text-purple-500" />
              Today&apos;s Check-outs
            </h2>
            <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-600">
              {todayCheckouts?.length ?? 0}
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {!todayCheckouts?.length ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">No check-outs today.</p>
            ) : (
              todayCheckouts.map((b) => {
                const occ  = Array.isArray(b.occupants) ? b.occupants[0] : b.occupants
                const room = Array.isArray(b.rooms)     ? b.rooms[0]     : b.rooms
                return (
                  <div key={b.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {occ?.first_name} {occ?.last_name}
                      </p>
                      <p className="text-xs text-slate-400 font-mono">{b.booking_ref}</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-700">
                      Room {room?.room_number ?? '—'}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
