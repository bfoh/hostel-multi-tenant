import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ClipboardList, CheckCircle2 } from 'lucide-react'
import { TaskCard } from '@/components/staff-portal/task-card'

export const metadata: Metadata = { title: 'My Tasks · Staff Portal' }

export default async function StaffTasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const h        = await headers()
  const tenantId = h.get('x-tenant-id')
  const color    = h.get('x-tenant-color') ?? '#2563EB'
  if (!tenantId) redirect('/login')

  const { data: tasksRaw } = await supabase
    .from('housekeeping_tasks')
    .select('id, status, priority, notes, due_date, rooms(room_number, block)')
    .eq('tenant_id', tenantId)
    .eq('assigned_to', user.id)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  const tasks   = (tasksRaw ?? []) as any[]
  const pending = tasks.filter(t => t.status !== 'done' && t.status !== 'skipped')
  const done    = tasks.filter(t => t.status === 'done')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">My Tasks</h1>
          <p className="text-xs text-slate-500 mt-0.5">{pending.length} pending · {done.length} completed today</p>
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}18` }}
        >
          <ClipboardList className="h-4.5 w-4.5" style={{ color }} />
        </div>
      </div>

      {/* Pending */}
      {pending.length === 0 && done.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-500">No tasks assigned to you</p>
          <p className="text-xs text-slate-400 mt-0.5">Check back later or contact your supervisor.</p>
        </div>
      )}

      {pending.length > 0 && (
        <section className="space-y-2.5">
          {pending.map(task => (
            <TaskCard
              key={task.id}
              task={{ ...task, rooms: Array.isArray(task.rooms) ? task.rooms[0] : task.rooms }}
              color={color}
            />
          ))}
        </section>
      )}

      {/* Completed */}
      {done.length > 0 && (
        <section>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Completed</p>
          <div className="space-y-2">
            {done.map(task => (
              <TaskCard
                key={task.id}
                task={{ ...task, rooms: Array.isArray(task.rooms) ? task.rooms[0] : task.rooms }}
                color={color}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
