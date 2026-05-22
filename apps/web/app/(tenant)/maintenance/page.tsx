import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, HardHat, CalendarClock, Zap } from 'lucide-react'

import { getMaintenanceRequests, getMaintenanceStats } from '@/lib/data/maintenance'
import { MaintenanceList, type MaintenanceRow } from '@/components/maintenance/maintenance-list'

export const metadata: Metadata = { title: 'Maintenance' }

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
        <div className="flex items-center gap-2">
          <Link
            href="/maintenance/schedules"
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised transition-colors"
          >
            <CalendarClock className="h-4 w-4" />
            PM Schedules
          </Link>
          <Link
            href="/maintenance/meters"
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised transition-colors"
          >
            <Zap className="h-4 w-4" />
            Meter Readings
          </Link>
          <Link
            href="/maintenance/new"
            className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
          >
            <Plus className="h-4 w-4" />
            New request
          </Link>
        </div>
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
        <MaintenanceList
          requests={requests.map((req: any): MaintenanceRow => {
            const room = Array.isArray(req.room) ? req.room[0] : req.room
            const contractor = Array.isArray(req.contractor) ? req.contractor[0] : req.contractor
            return {
              id:             req.id,
              ref_number:     req.ref_number,
              title:          req.title,
              description:    req.description ?? null,
              priority:       req.priority,
              category:       req.category,
              status:         req.status,
              created_at:     req.created_at,
              roomLabel:      room ? `Room ${room.room_number}${room.block ? `, Block ${room.block}` : ''}` : null,
              contractorName: contractor?.name ?? null,
            }
          })}
        />
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

