'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X } from 'lucide-react'

export function VisitorCheckIn() {
  const router = useRouter()
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const [form, setForm] = useState({
    visitor_name:  '',
    visitor_phone: '',
    visitor_id:    '',
    purpose:       'visit_occupant',
    host_name:     '',
    room_number:   '',
    vehicle_plate: '',
    notes:         '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/security/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, visitor_phone: form.visitor_phone || null, visitor_id: form.visitor_id || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(JSON.stringify(data.error))
      setOpen(false)
      setForm({ visitor_name: '', visitor_phone: '', visitor_id: '', purpose: 'visit_occupant', host_name: '', room_number: '', vehicle_plate: '', notes: '' })
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
        <UserPlus className="h-4 w-4" /> Check in visitor
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-text-primary">Visitor check-in</h2>
              <button onClick={() => setOpen(false)} className="text-text-disabled hover:text-text-primary transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <Field label="Visitor name *">
                <input value={form.visitor_name} onChange={e => set('visitor_name', e.target.value)} required className={inputCls} placeholder="Kofi Asante" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone">
                  <input value={form.visitor_phone} onChange={e => set('visitor_phone', e.target.value)} className={inputCls} placeholder="024..." />
                </Field>
                <Field label="ID number">
                  <input value={form.visitor_id} onChange={e => set('visitor_id', e.target.value)} className={inputCls} placeholder="Ghana Card" />
                </Field>
              </div>
              <Field label="Purpose *">
                <select value={form.purpose} onChange={e => set('purpose', e.target.value)} className={inputCls}>
                  <option value="visit_occupant">Visit occupant</option>
                  <option value="delivery">Delivery</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="official">Official</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Host name">
                  <input value={form.host_name} onChange={e => set('host_name', e.target.value)} className={inputCls} placeholder="Student name" />
                </Field>
                <Field label="Room">
                  <input value={form.room_number} onChange={e => set('room_number', e.target.value)} className={inputCls} placeholder="e.g. 12A" />
                </Field>
              </div>
              <Field label="Vehicle plate">
                <input value={form.vehicle_plate} onChange={e => set('vehicle_plate', e.target.value)} className={inputCls} placeholder="GR-1234-22" />
              </Field>

              {error && <p className="text-sm text-danger">{error}</p>}

              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setOpen(false)} className={cancelCls}>Cancel</button>
                <button type="submit" disabled={saving} className={submitCls}>
                  {saving ? 'Checking in…' : 'Check in'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-text-secondary">{label}</label>
      {children}
    </div>
  )
}

const inputCls  = 'w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-colors'
const cancelCls = 'rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised transition-colors'
const submitCls = 'rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-50 transition-colors'
