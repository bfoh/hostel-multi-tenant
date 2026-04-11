import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Wrench, CheckCircle2 } from 'lucide-react'
import { MaintenanceCard } from '@/components/staff-portal/maintenance-card'

export const metadata: Metadata = { title: 'Maintenance · Staff Portal' }

export default async function StaffMaintenancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const h        = await headers()
  const tenantId = h.get('x-tenant-id')
  const color    = h.get('x-tenant-color') ?? '#2563EB'
  if (!tenantId) redirect('/login')

  const { data: openRaw } = await supabase
    .from('maintenance_requests')
    .select('id, title, category, priority, status, description, created_at, rooms(room_number)')
    .eq('tenant_id', tenantId)
    .in('status', ['open', 'in_progress'])
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: recentRaw } = await supabase
    .from('maintenance_requests')
    .select('id, title, category, priority, status, description, created_at, rooms(room_number)')
    .eq('tenant_id', tenantId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(10)

  const open   = (openRaw   ?? []) as any[]
  const recent = (recentRaw ?? []) as any[]

  const normalise = (r: any) => ({ ...r, rooms: Array.isArray(r.rooms) ? r.rooms[0] : r.rooms })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Maintenance Requests</h1>
          <p className="text-xs text-slate-500 mt-0.5">{open.length} open · tap a card to update status</p>
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}18` }}
        >
          <Wrench className="h-4.5 w-4.5" style={{ color }} />
        </div>
      </div>

      {open.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-500">No open requests</p>
          <p className="text-xs text-slate-400 mt-0.5">All maintenance issues have been resolved.</p>
        </div>
      )}

      {open.length > 0 && (
        <section className="space-y-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Open &amp; In Progress</p>
          {open.map(r => <MaintenanceCard key={r.id} req={normalise(r)} color={color} />)}
        </section>
      )}

      {recent.length > 0 && (
        <section className="space-y-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Recently Completed</p>
          {recent.map(r => <MaintenanceCard key={r.id} req={normalise(r)} color={color} />)}
        </section>
      )}
    </div>
  )
}
