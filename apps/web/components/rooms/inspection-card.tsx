'use client'

import { useState } from 'react'
import { Plus, Trash2, Loader2, ClipboardCheck, ChevronDown, ChevronUp } from 'lucide-react'

interface InspectionItem { item: string; condition: string; notes?: string }
interface Inspection {
  id: string; type: string; overall_condition: string | null
  items: InspectionItem[]; notes: string | null; inspected_at: string | null; status: string
}

const CONDITION_COLORS: Record<string, string> = {
  good:    'bg-success-subtle text-success',
  fair:    'bg-warning-subtle text-warning-fg',
  damaged: 'bg-danger-subtle text-danger',
  missing: 'bg-surface-sunken text-text-secondary',
}
const OVERALL_COLORS: Record<string, string> = {
  excellent: 'text-success', good: 'text-brand',
  fair: 'text-warning-fg', poor: 'text-danger',
}

const DEFAULT_ITEMS = [
  'Bed frame', 'Mattress', 'Wardrobe', 'Study desk', 'Chair',
  'Window/louvres', 'Door lock', 'Ceiling fan', 'Lighting', 'Floor condition',
]

export function InspectionCard({ roomId, initialInspections }: { roomId: string; initialInspections: Inspection[] }) {
  const [inspections, setInspections] = useState(initialInspections)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState<string>('check_in')
  const [overall, setOverall] = useState<string>('good')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<InspectionItem[]>(
    DEFAULT_ITEMS.map((item) => ({ item, condition: 'good', notes: '' }))
  )
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function updateItem(i: number, field: keyof InspectionItem, val: string) {
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/rooms/${roomId}/inspections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, overall_condition: overall, items, notes: notes || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setInspections((prev) => [data, ...prev])
      setShowForm(false)
      setNotes('')
      setItems(DEFAULT_ITEMS.map((item) => ({ item, condition: 'good', notes: '' })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this inspection?')) return
    setDeletingId(id)
    await fetch(`/api/inspections/${id}`, { method: 'DELETE' })
    setInspections((prev) => prev.filter((i) => i.id !== id))
    setDeletingId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">{inspections.length} inspection{inspections.length !== 1 ? 's' : ''} recorded</p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New inspection
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={submit} className="rounded-xl border border-border bg-surface-raised p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-text-tertiary">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand">
                <option value="check_in">Check-in</option>
                <option value="check_out">Check-out</option>
                <option value="routine">Routine</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-tertiary">Overall condition</label>
              <select value={overall} onChange={(e) => setOverall(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand">
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-text-tertiary">Item checklist</p>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <p className="col-span-4 text-sm text-text-primary truncate">{it.item}</p>
                  <select
                    value={it.condition}
                    onChange={(e) => updateItem(i, 'condition', e.target.value)}
                    className="col-span-3 rounded-lg border border-border bg-surface px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="damaged">Damaged</option>
                    <option value="missing">Missing</option>
                  </select>
                  <input
                    value={it.notes}
                    onChange={(e) => updateItem(i, 'notes', e.target.value)}
                    placeholder="Notes"
                    className="col-span-5 rounded-lg border border-border bg-surface px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-tertiary">General notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand resize-none"
            />
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
              Save inspection
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {inspections.length === 0 && !showForm && (
        <p className="py-8 text-center text-sm text-text-tertiary">No inspections yet</p>
      )}
      <div className="space-y-2">
        {inspections.map((insp) => (
          <div key={insp.id} className="rounded-xl border border-border bg-surface overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === insp.id ? null : insp.id)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-raised transition-colors"
            >
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm font-medium text-text-primary capitalize">{insp.type.replace('_', '-')} inspection</p>
                  <p className="text-xs text-text-tertiary">
                    {insp.inspected_at ? new Date(insp.inspected_at).toLocaleDateString('en-GH', { dateStyle: 'medium' }) : 'Draft'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {insp.overall_condition && (
                  <span className={`text-xs font-medium capitalize ${OVERALL_COLORS[insp.overall_condition] ?? ''}`}>
                    {insp.overall_condition}
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); remove(insp.id) }}
                  disabled={deletingId === insp.id}
                  className="p-1 text-text-tertiary hover:text-danger transition-colors"
                >
                  {deletingId === insp.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
                {expanded === insp.id ? <ChevronUp className="h-4 w-4 text-text-tertiary" /> : <ChevronDown className="h-4 w-4 text-text-tertiary" />}
              </div>
            </button>
            {expanded === insp.id && (
              <div className="border-t border-border px-4 py-3 space-y-3">
                {(insp.items as InspectionItem[]).length > 0 && (
                  <div className="space-y-1.5">
                    {(insp.items as InspectionItem[]).map((it, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-text-secondary">{it.item}</span>
                        <div className="flex items-center gap-2">
                          {it.notes && <span className="text-xs text-text-tertiary">{it.notes}</span>}
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CONDITION_COLORS[it.condition] ?? ''}`}>
                            {it.condition}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {insp.notes && <p className="text-sm text-text-secondary border-t border-border pt-2">{insp.notes}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
