import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ClipboardList, Wrench, CheckCircle2 } from 'lucide-react'
import { TaskCard } from '@/components/staff-portal/task-card'
import { MaintenanceCard } from '@/components/staff-portal/maintenance-card'

export const metadata: Metadata = { title: 'Tasks · Staff' }
export const dynamic = 'force-dynamic'

export default async function StaffMobileTasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const h        = await headers()
  const tenantId = h.get('x-tenant-id')
  const color    = h.get('x-tenant-color') ?? '#2F7D57'
  if (!tenantId) redirect('/login')

  const admin = createAdminClient() as any

  const { data: staffProfile } = await admin
    .from('staff_profiles')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .maybeSingle()

  const [{ data: hkRaw }, { data: openMaintRaw }] = await Promise.all([
    staffProfile
      ? admin
          .from('housekeeping_tasks')
          .select('id, status, priority, notes, due_by, rooms:rooms(room_number, block)')
          .eq('tenant_id', tenantId)
          .eq('assigned_to', staffProfile.id)
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
    admin
      .from('maintenance_requests')
      .select('id, title, category, priority, status, description, created_at, rooms:rooms(room_number)')
      .eq('tenant_id', tenantId)
      .in('status', ['open', 'in_progress'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const hkTasks = ((hkRaw ?? []) as any[]).map((t) => ({
    ...t,
    due_date: t.due_by,
    rooms: Array.isArray(t.rooms) ? t.rooms[0] : t.rooms,
  }))
  const hkPending = hkTasks.filter((t) => t.status !== 'done')
  const hkDone    = hkTasks.filter((t) => t.status === 'done')

  const openMaint = ((openMaintRaw ?? []) as any[]).map((r) => ({
    ...r,
    rooms: Array.isArray(r.rooms) ? r.rooms[0] : r.rooms,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Tasks</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {hkPending.length} housekeeping · {openMaint.length} open maintenance
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}18` }}>
          <ClipboardList className="h-4.5 w-4.5" style={{ color }} />
        </div>
      </div>

      {/* My housekeeping */}
      <section className="space-y-2.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">My Housekeeping</p>
        {hkPending.length === 0 && hkDone.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">No housekeeping tasks assigned to you</p>
          </div>
        ) : (
          <>
            {hkPending.map((task) => <TaskCard key={task.id} task={task} color={color} />)}
            {hkDone.map((task) => <TaskCard key={task.id} task={task} color={color} />)}
          </>
        )}
      </section>

      {/* Maintenance */}
      <section className="space-y-2.5">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <Wrench className="h-3 w-3" /> Open Maintenance
        </p>
        {openMaint.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">No open maintenance requests</p>
          </div>
        ) : (
          openMaint.map((req) => <MaintenanceCard key={req.id} req={req} color={color} />)
        )}
      </section>
    </div>
  )
}
