import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, HardHat, CalendarClock, Zap, List, LayoutGrid, Search } from 'lucide-react'

import { getMaintenanceRequestsPage, getMaintenanceStats } from '@/lib/data/maintenance'
import { MaintenanceList, type MaintenanceRow } from '@/components/maintenance/maintenance-list'
import { MaintenanceKanban } from '@/components/maintenance/maintenance-kanban'
import { ListPagination } from '@/components/ui/list-pagination'

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
  searchParams: Promise<{ status?: string; priority?: string; view?: string; q?: string; page?: string }>
}) {
  const { status, priority, view, q = '', page: pageParam } = await searchParams
  const activeStatus   = status   ?? 'all'
  const activePriority = priority ?? 'all'
  const activeView     = view === 'kanban' ? 'kanban' : 'list'

  function viewHref(v: 'list' | 'kanban') {
    const params = new URLSearchParams()
    if (activeStatus !== 'all')   params.set('status', activeStatus)
    if (activePriority !== 'all') params.set('priority', activePriority)
    if (v !== 'list') params.set('view', v)
    const qs = params.toString()
    return qs ? `/maintenance?${qs}` : '/maintenance'
  }

  const [result, stats] = await Promise.all([
    getMaintenanceRequestsPage({
      status: activeStatus,
      priority: activePriority,
      search: q,
      page: Number.parseInt(pageParam ?? '1', 10),
    }),
    getMaintenanceStats(),
  ])
  const { rows: requests, total, page, pageSize } = result

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Maintenance</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {total} work order{total !== 1 ? 's' : ''}
            {activeStatus !== 'all' ? ` · ${activeStatus.replace('_', ' ')}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

      <form method="get" className="flex max-w-lg gap-2">
        {activeStatus !== 'all' && <input type="hidden" name="status" value={activeStatus} />}
        {activePriority !== 'all' && <input type="hidden" name="priority" value={activePriority} />}
        {activeView !== 'list' && <input type="hidden" name="view" value={activeView} />}
        <div className="relative flex-1">
          <Search className="text-text-disabled pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search reference, title, description, notes, or reporter…"
            className="border-border bg-surface text-text-primary placeholder:text-text-disabled focus:border-brand w-full rounded-md border py-2 pl-9 pr-3 text-sm focus:outline-none"
          />
        </div>
        <button className="bg-brand text-brand-fg hover:bg-brand-hover rounded-md px-3 py-2 text-sm font-semibold">
          Search
        </button>
      </form>

      {/* ── KPI strip ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4">
        <KpiCard label="Open" value={stats.open} color="warning" />
        <KpiCard label="In progress" value={stats.in_progress} color="brand" />
        <KpiCard label="Completed" value={stats.completed} color="success" />
        <KpiCard label="Urgent" value={stats.urgent} color="danger" />
      </div>

      {/* ── Filters ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3 flex-wrap">
          <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1">
            {STATUSES.map(s => (
              <Link
                key={s.value}
                href={s.value === 'all' ? viewHref(activeView) : `/maintenance?status=${s.value}${activePriority !== 'all' ? `&priority=${activePriority}` : ''}${activeView === 'kanban' ? '&view=kanban' : ''}`}
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
                href={p.value === 'all' ? `/maintenance${activeStatus !== 'all' ? `?status=${activeStatus}` : ''}${activeView === 'kanban' ? `${activeStatus !== 'all' ? '&' : '?'}view=kanban` : ''}` : `/maintenance?${activeStatus !== 'all' ? `status=${activeStatus}&` : ''}priority=${p.value}${activeView === 'kanban' ? '&view=kanban' : ''}`}
                className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${activePriority === p.value ? 'bg-brand text-brand-fg shadow-sm' : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'}`}
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          <Link
            href={viewHref('list')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${activeView === 'list' ? 'bg-brand text-brand-fg shadow-sm' : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'}`}
          >
            <List className="h-3.5 w-3.5" /> List
          </Link>
          <Link
            href={viewHref('kanban')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${activeView === 'kanban' ? 'bg-brand text-brand-fg shadow-sm' : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Kanban
          </Link>
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
      ) : activeView === 'kanban' ? (
        <>
          <MaintenanceKanban requests={requests.map(toMaintenanceRow)} />
          <ListPagination pathname="/maintenance" page={page} pageSize={pageSize} total={total} params={{ status: activeStatus === 'all' ? undefined : activeStatus, priority: activePriority === 'all' ? undefined : activePriority, view: 'kanban', q }} />
        </>
      ) : (
        <>
          <MaintenanceList requests={requests.map(toMaintenanceRow)} />
          <ListPagination pathname="/maintenance" page={page} pageSize={pageSize} total={total} params={{ status: activeStatus === 'all' ? undefined : activeStatus, priority: activePriority === 'all' ? undefined : activePriority, q }} />
        </>
      )}
    </div>
  )
}

function toMaintenanceRow(req: any): MaintenanceRow {
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
