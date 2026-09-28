'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { MaintenanceRow } from './maintenance-list'

const PRIORITY_STYLES: Record<string, string> = {
  low:    'bg-surface-sunken text-text-secondary border-border',
  medium: 'bg-brand-subtle text-brand border-brand/20',
  high:   'bg-warning-subtle text-warning-fg border-warning/20',
  urgent: 'bg-danger-subtle text-danger border-danger/20',
}

const COLUMNS: Array<{ key: 'open' | 'in_progress' | 'completed'; label: string; statuses: string[] }> = [
  { key: 'open',        label: 'Open',        statuses: ['open'] },
  { key: 'in_progress', label: 'In Progress', statuses: ['in_progress', 'on_hold'] },
  { key: 'completed',   label: 'Completed',   statuses: ['completed'] },
]

/**
 * Kanban view of maintenance_requests — an alternative to the existing
 * flat MaintenanceList, not a replacement (same view-switcher pattern as
 * the bookings calendar's Timeline/Grid/List). Cancelled requests are
 * omitted; on_hold is folded into the In Progress column with its own
 * badge rather than a fourth column.
 */
export function MaintenanceKanban({ requests }: { requests: MaintenanceRow[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {COLUMNS.map((col) => {
        const items = requests.filter((r) => col.statuses.includes(r.status))
        return (
          <div key={col.key} className="rounded-xl border border-border bg-surface-sunken/50 p-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold text-text-primary">{col.label}</h3>
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-text-secondary">
                {items.length}
              </span>
            </div>
            <div className="space-y-2">
              {items.length === 0 ? (
                <p className="px-1 py-6 text-center text-xs text-text-tertiary">Nothing here</p>
              ) : (
                items.map((req) => <KanbanCard key={req.id} req={req} />)
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function KanbanCard({ req }: { req: MaintenanceRow }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const nextStatus = req.status === 'open' ? 'in_progress' : req.status === 'in_progress' ? 'completed' : null

  async function advance(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!nextStatus) return
    setBusy(true)
    try {
      await fetch(`/api/maintenance/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Link
      href={`/maintenance/${req.id}`}
      className="block rounded-lg border border-border bg-surface p-3 transition-colors hover:border-brand/40"
    >
      <div className="flex items-center gap-2">
        <span className="ref-number text-[11px] text-text-tertiary">{req.ref_number}</span>
        {req.priority === 'urgent' && <AlertTriangle className="h-3 w-3 text-danger" />}
        {req.status === 'on_hold' && (
          <span className="rounded-full bg-surface-sunken px-1.5 py-0.5 text-[10px] font-medium text-text-tertiary">On hold</span>
        )}
      </div>
      <p className="mt-1 text-sm font-medium text-text-primary line-clamp-2">{req.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text-tertiary">
        <span className="capitalize">{req.category.replace('_', ' ')}</span>
        {req.roomLabel && <span>{req.roomLabel}</span>}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium capitalize ${PRIORITY_STYLES[req.priority] ?? ''}`}>
          {req.priority}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-disabled">{formatDate(req.created_at)}</span>
          {nextStatus && (
            <button
              type="button"
              onClick={advance}
              disabled={busy}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-brand transition-colors hover:text-brand-hover disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3 w-3 animate-spin" />}
              {nextStatus === 'in_progress' ? 'Start →' : 'Complete →'}
            </button>
          )}
        </div>
      </div>
    </Link>
  )
}
