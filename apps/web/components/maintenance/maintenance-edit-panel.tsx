'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

interface Contractor { id: string; name: string; phone: string | null }

interface Props {
  requestId:         string
  currentStatus:     string
  currentPriority:   string
  currentContractorId: string | null
  currentActualCost: number | null
  currentNotes:      string | null
  currentScheduled:  string | null
  contractors:       Contractor[]
}

const STATUS_OPTIONS = [
  { value: 'open',        label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'on_hold',     label: 'On hold' },
  { value: 'completed',   label: 'Completed' },
  { value: 'cancelled',   label: 'Cancelled' },
]

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const inputCls = 'w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-colors'

export function MaintenanceEditPanel({
  requestId,
  currentStatus,
  currentPriority,
  currentContractorId,
  currentActualCost,
  currentNotes,
  currentScheduled,
  contractors,
}: Props) {
  const router = useRouter()
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState(false)

  const [status,        setStatus]        = useState(currentStatus)
  const [priority,      setPriority]      = useState(currentPriority)
  const [contractorId,  setContractorId]  = useState(currentContractorId ?? '')
  const [actualCost,    setActualCost]    = useState(
    currentActualCost != null ? String(currentActualCost / 100) : ''
  )
  const [notes,         setNotes]         = useState(currentNotes ?? '')
  const [scheduledDate, setScheduledDate] = useState(
    currentScheduled ? currentScheduled.slice(0, 10) : ''
  )

  async function save() {
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch(`/api/maintenance/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          priority,
          contractor_id:  contractorId || null,
          actual_cost:    actualCost ? Math.round(parseFloat(actualCost) * 100) : null,
          notes:          notes || null,
          scheduled_date: scheduledDate || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? 'Save failed')
      }
      setSuccess(true)
      router.refresh()
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  async function destroy() {
    if (!confirm('Delete this work order? This cannot be undone.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/maintenance/${requestId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      router.push('/maintenance')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">Priority</label>
          <select value={priority} onChange={e => setPriority(e.target.value)} className={inputCls}>
            {PRIORITY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-secondary">Assigned contractor</label>
        <select value={contractorId} onChange={e => setContractorId(e.target.value)} className={inputCls}>
          <option value="">Unassigned</option>
          {contractors.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}{c.phone ? ` — ${c.phone}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">Scheduled date</label>
          <input
            type="date"
            value={scheduledDate}
            onChange={e => setScheduledDate(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">Actual cost (GH₵)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={actualCost}
            onChange={e => setActualCost(e.target.value)}
            placeholder="0.00"
            className={inputCls}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-secondary">Internal notes</label>
        <textarea
          rows={3}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Add notes…"
          className={`${inputCls} resize-none`}
        />
      </div>

      {error   && <p className="rounded-md bg-danger-subtle border border-danger/20 px-3 py-2 text-sm text-danger">{error}</p>}
      {success && <p className="rounded-md bg-success-subtle border border-success/20 px-3 py-2 text-sm text-success">Saved successfully.</p>}

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button
          onClick={destroy}
          disabled={deleting}
          className="flex items-center gap-1.5 rounded-md border border-danger/30 px-3 py-2 text-sm font-medium text-danger hover:bg-danger-subtle disabled:opacity-50 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  )
}
