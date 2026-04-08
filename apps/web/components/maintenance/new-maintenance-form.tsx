'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CATEGORIES = [
  { value: 'plumbing',     label: 'Plumbing' },
  { value: 'electrical',   label: 'Electrical' },
  { value: 'hvac',         label: 'HVAC / Ventilation' },
  { value: 'structural',   label: 'Structural' },
  { value: 'furniture',    label: 'Furniture' },
  { value: 'appliance',    label: 'Appliance' },
  { value: 'cleaning',     label: 'Cleaning' },
  { value: 'pest_control', label: 'Pest control' },
  { value: 'security',     label: 'Security' },
  { value: 'other',        label: 'Other' },
]

interface Room { id: string; room_number: string; block?: string | null }
interface Contractor { id: string; name: string; phone?: string | null }

export function NewMaintenanceForm({
  rooms,
  contractors,
}: {
  rooms: Room[]
  contractors: Contractor[]
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const [form, setForm] = useState({
    title:          '',
    description:    '',
    category:       'other',
    priority:       'medium',
    room_id:        '',
    contractor_id:  '',
    estimated_cost: '',
    notes:          '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          room_id:        form.room_id || null,
          contractor_id:  form.contractor_id || null,
          estimated_cost: form.estimated_cost ? Math.round(parseFloat(form.estimated_cost) * 100) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(JSON.stringify(data.error))
      router.push('/maintenance')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-6 space-y-4">
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Title *</label>
        <input value={form.title} onChange={e => set('title', e.target.value)}
          required className={inputCls} placeholder="e.g. Leaking tap in Room 12" />
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Description</label>
        <textarea value={form.description} onChange={e => set('description', e.target.value)}
          className={inputCls} rows={3} placeholder="Describe the issue in detail…" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Category *</label>
          <select value={form.category} onChange={e => set('category', e.target.value)} className={inputCls}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Priority *</label>
          <select value={form.priority} onChange={e => set('priority', e.target.value)} className={inputCls}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Room</label>
          <select value={form.room_id} onChange={e => set('room_id', e.target.value)} className={inputCls}>
            <option value="">No specific room</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>
                Room {r.room_number}{r.block ? ` (Block ${r.block})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Assign contractor</label>
          <select value={form.contractor_id} onChange={e => set('contractor_id', e.target.value)} className={inputCls}>
            <option value="">Unassigned</option>
            {contractors.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Estimated cost (GH₵)</label>
        <input type="number" step="0.01" min="0" value={form.estimated_cost}
          onChange={e => set('estimated_cost', e.target.value)}
          className={inputCls} placeholder="0.00" />
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Internal notes</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
          className={inputCls} rows={2} placeholder="Any additional notes…" />
      </div>

      {error && (
        <p className="rounded-md bg-danger-subtle border border-danger/20 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <div className="flex gap-2 justify-end pt-2">
        <button type="button" onClick={() => router.back()}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="rounded-md bg-brand px-5 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-50 transition-colors">
          {saving ? 'Submitting…' : 'Submit request'}
        </button>
      </div>
    </form>
  )
}

const inputCls = 'w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-colors'
