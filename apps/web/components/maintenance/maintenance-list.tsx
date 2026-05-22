'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2 } from 'lucide-react'

import { formatDate } from '@/lib/utils'
import { useBulkSelect, BulkActionBar } from '@/components/ui/bulk-select'

export interface MaintenanceRow {
  id:             string
  ref_number:     string
  title:          string
  description:    string | null
  priority:       string
  category:       string
  status:         string
  created_at:     string
  roomLabel:      string | null
  contractorName: string | null
}

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

export function MaintenanceList({ requests }: { requests: MaintenanceRow[] }) {
  const bulk = useBulkSelect(requests.map((r) => r.id))

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <BulkActionBar bulk={bulk} resource="maintenance_requests" itemNoun="request" />
      </div>

      {requests.map((req) => {
        const card = (
          <div
            className={`block rounded-xl border bg-surface p-4 transition-colors ${
              bulk.selectMode
                ? bulk.isSelected(req.id)
                  ? 'border-brand ring-2 ring-brand/30'
                  : 'border-border hover:border-brand/40'
                : 'border-border hover:bg-surface-raised'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {bulk.selectMode && (
                  <input
                    type="checkbox"
                    checked={bulk.isSelected(req.id)}
                    onChange={() => bulk.toggle(req.id)}
                    className="mt-1 h-4 w-4 rounded border-border text-brand focus:ring-brand"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="ref-number text-xs text-text-tertiary">{req.ref_number}</span>
                    {req.priority === 'urgent' && <AlertTriangle className="h-3.5 w-3.5 text-danger" />}
                  </div>
                  <p className="mt-0.5 text-sm font-semibold text-text-primary">{req.title}</p>
                  {req.description && (
                    <p className="mt-0.5 text-xs text-text-secondary line-clamp-1">{req.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
                    <span className="capitalize">{req.category.replace('_', ' ')}</span>
                    {req.roomLabel && <span>{req.roomLabel}</span>}
                    {req.contractorName && <span>Contractor: {req.contractorName}</span>}
                    <span>{formatDate(req.created_at)}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${PRIORITY_STYLES[req.priority] ?? 'bg-surface-sunken text-text-secondary border-border'}`}>
                  {req.priority}
                </span>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[req.status] ?? 'bg-surface-sunken text-text-secondary border-border'}`}>
                  {req.status.replace('_', ' ')}
                </span>
                {!bulk.selectMode && <StatusAction requestId={req.id} currentStatus={req.status} />}
              </div>
            </div>
          </div>
        )

        return bulk.selectMode ? (
          <button key={req.id} type="button" onClick={() => bulk.toggle(req.id)} className="block w-full text-left">
            {card}
          </button>
        ) : (
          <Link key={req.id} href={`/maintenance/${req.id}`}>
            {card}
          </Link>
        )
      })}
    </div>
  )
}

function StatusAction({ requestId, currentStatus }: { requestId: string; currentStatus: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (currentStatus === 'completed' || currentStatus === 'cancelled') return null
  const nextStatus = currentStatus === 'open' ? 'in_progress' : currentStatus === 'in_progress' ? 'completed' : null
  if (!nextStatus) return null

  async function advance(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setBusy(true)
    try {
      await fetch(`/api/maintenance/${requestId}`, {
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
    <button
      type="button"
      onClick={advance}
      disabled={busy}
      className="inline-flex items-center gap-1 text-[11px] text-brand hover:text-brand-hover transition-colors font-medium disabled:opacity-50"
    >
      {busy && <Loader2 className="h-3 w-3 animate-spin" />}
      {nextStatus === 'in_progress' ? 'Start →' : 'Complete →'}
    </button>
  )
}
