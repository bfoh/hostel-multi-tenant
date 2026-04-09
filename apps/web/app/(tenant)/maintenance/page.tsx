import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, HardHat, AlertTriangle } from 'lucide-react'

import { getMaintenanceRequests, getMaintenanceStats } from '@/lib/data/maintenance'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Maintenance' }

const PRIORITY_STYLES: Record<string, string> = {
  low:    'bg-surface-sunken text-text-secondary border-border',
  medium: 'bg-brand-subtle text-brand border-brand/20',
  high:   'bg-warning-subtle text-warning-fg border-warning/20',
  urgent: 'bg-danger-subtle text-danger border-danger/20',
}

const STATUS_STYLES: Record<string, string> = {
  open:        'bg-warning-subtle text-warning-fg border-warning/20',
  in_progress: 'bg-brand-subtle text-brand border-brand/20',
  on_hold:     'bg-surface-sunken text-text-secondary border-border',
  completed:   'bg-success-subtle text-success border-success/20',
  cancelled:   'bg-surface-sunken text-text-secondary border-border',
}

const STATUSES = [
  { value: 'all',         label: 'All' },
  { value: 'open',        label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'on_hold',     label: 'On hold' },
  { value: 'completed',   label: 'Completed' },
]

const PRIORITIES = [
  { value: 'all',    label: 'All priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high',   label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low',    label: 'Low' },
]

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string }>
}) {
  const { status, priority } = await searchParams
  const activeStatus   = status   ?? 'all'
  const activePriority = priority ?? 'all'

  const [requests, stats] = await Promise.all([
    getMaintenanceRequests({ status: activeStatus, priority: activePriority }),
    getMaintenanceStats(),
  ])

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Maintenance</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {requests.length} work order{requests.length !== 1 ? 's' : ''}
            {activeStatus !== 'all' ? ` · ${activeStatus.replace('_', ' ')}` : ''}
          </p>
        </div>
        <Link
          href="/maintenance/new"
          className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
        >
          <Plus className="h-4 w-4" />
          New request
        </Link>
      </div>

      {/* ── KPI strip ────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Open" value={stats.open} color="warning" />
        <KpiCard label="In progress" value={stats.in_progress} color="brand" />
        <KpiCard label="Completed" value={stats.completed} color="success" />
        <KpiCard label="Urgent" value={stats.urgent} color="danger" />
      </div>

      {/* ── Filters ──────────────────────────────────────────────── */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1">
          {STATUSES.map(s => (
            <Link
              key={s.value}
              href={s.value === 'all' ? '/maintenance' : `/maintenance?status=${s.value}${activePriority !== 'all' ? `&priority=${activePriority}` : ''}`}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${activeStatus === s.value ? 'bg-brand text-brand-fg shadow-sm' : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'}`}
            >
              {s.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1">
          {PRIORITIES.map(p => (
            <Link
              key={p.value}
              href={p.value === 'all' ? `/maintenance${activeStatus !== 'all' ? `?status=${activeStatus}` : ''}` : `/maintenance?${activeStatus !== 'all' ? `status=${activeStatus}&` : ''}priority=${p.value}`}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${activePriority === p.value ? 'bg-brand text-brand-fg shadow-sm' : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'}`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── List ─────────────────────────────────────────────────── */}
      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <HardHat className="h-10 w-10 text-text-disabled" />
          <div>
            <p className="font-medium text-text-primary">No work orders found</p>
            <p className="mt-0.5 text-sm text-text-secondary">Log maintenance issues to track repairs and contractors.</p>
          </div>
          <Link href="/maintenance/new" className="mt-2 flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors">
            <Plus className="h-4 w-4" /> New request
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map(req => {
            const room = Array.isArray(req.room) ? req.room[0] : req.room
            const contractor = Array.isArray(req.contractor) ? req.contractor[0] : req.contractor
            return (
              <Link key={req.id} href={`/maintenance/${req.id}`} className="block rounded-xl border border-border bg-surface p-4 hover:bg-surface-raised transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="ref-number text-xs text-text-tertiary">{req.ref_number}</span>
                      {req.priority === 'urgent' && (
                        <AlertTriangle className="h-3.5 w-3.5 text-danger" />
                      )}
                    </div>
                    <p className="mt-0.5 text-sm font-semibold text-text-primary">{req.title}</p>
                    {req.description && (
                      <p className="mt-0.5 text-xs text-text-secondary line-clamp-1">{req.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
                      <span className="capitalize">{req.category.replace('_', ' ')}</span>
                      {room && <span>Room {room.room_number}{room.block ? `, Block ${room.block}` : ''}</span>}
                      {contractor && <span>Contractor: {contractor.name}</span>}
                      <span>{formatDate(req.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${PRIORITY_STYLES[req.priority] ?? 'bg-surface-sunken text-text-secondary border-border'}`}>
                      {req.priority}
                    </span>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[req.status] ?? 'bg-surface-sunken text-text-secondary border-border'}`}>
                      {req.status.replace('_', ' ')}
                    </span>
                    <MaintenanceStatusAction requestId={req.id} currentStatus={req.status} />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, color }: { label: string; value: number; color: 'warning' | 'brand' | 'success' | 'danger' }) {
  const colors = {
    warning: 'text-warning-fg',
    brand:   'text-brand',
    success: 'text-success',
    danger:  'text-danger',
  }
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${colors[color]}`}>{value}</p>
    </div>
  )
}

function MaintenanceStatusAction({ requestId, currentStatus }: { requestId: string; currentStatus: string }) {
  if (currentStatus === 'completed' || currentStatus === 'cancelled') return null
  const nextStatus = currentStatus === 'open' ? 'in_progress' : currentStatus === 'in_progress' ? 'completed' : null
  if (!nextStatus) return null

  return (
    <form action={async () => {
      'use server'
      const { createClient } = await import('@/lib/supabase/server')
      const { headers } = await import('next/headers')
      const { revalidatePath } = await import('next/cache')
      const headersList = await headers()
      const tenantId = headersList.get('x-tenant-id')
      if (!tenantId) return
      const supabase = await createClient()
      if (nextStatus === 'completed') {
        await supabase.from('maintenance_requests').update({ status: 'completed', resolved_at: new Date().toISOString() }).eq('id', requestId).eq('tenant_id', tenantId)
      } else {
        await supabase.from('maintenance_requests').update({ status: nextStatus as 'in_progress' }).eq('id', requestId).eq('tenant_id', tenantId)
      }
      revalidatePath('/maintenance')
    }}>
      <button type="submit" className="text-[11px] text-brand hover:text-brand-hover transition-colors font-medium">
        {nextStatus === 'in_progress' ? 'Start →' : 'Complete →'}
      </button>
    </form>
  )
}
