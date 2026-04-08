'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'

interface StaffOption {
  id: string
  first_name: string
  last_name: string
}

const LEAVE_TYPES = [
  { value: 'annual',    label: 'Annual leave' },
  { value: 'sick',      label: 'Sick leave' },
  { value: 'maternity', label: 'Maternity leave' },
  { value: 'paternity', label: 'Paternity leave' },
  { value: 'emergency', label: 'Emergency leave' },
  { value: 'unpaid',    label: 'Unpaid leave' },
]

export function LeaveActions({ staff }: { staff: StaffOption[] }) {
  const router = useRouter()
  const [open, setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const [form, setForm] = useState({
    staff_id:   '',
    leave_type: 'annual',
    start_date: '',
    end_date:   '',
    reason:     '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(JSON.stringify(data.error))
      setOpen(false)
      setForm({ staff_id: '', leave_type: 'annual', start_date: '', end_date: '', reason: '' })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setError(null) }}
        className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
      >
        <Plus className="h-4 w-4" /> Request leave
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-text-primary">New leave request</h2>
              <button onClick={() => setOpen(false)} className="text-text-disabled hover:text-text-primary transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Staff member *</label>
                <select value={form.staff_id} onChange={e => set('staff_id', e.target.value)}
                  required className={inputCls}>
                  <option value="">Select staff…</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Leave type *</label>
                <select value={form.leave_type} onChange={e => set('leave_type', e.target.value)}
                  required className={inputCls}>
                  {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Start date *</label>
                  <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)}
                    required className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">End date *</label>
                  <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)}
                    required className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Reason</label>
                <textarea value={form.reason} onChange={e => set('reason', e.target.value)}
                  className={inputCls} rows={3} placeholder="Optional reason…" />
              </div>

              {error && <p className="text-sm text-danger">{error}</p>}

              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setOpen(false)}
                  className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-50 transition-colors">
                  {saving ? 'Submitting…' : 'Submit request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

const inputCls = 'w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-colors'
