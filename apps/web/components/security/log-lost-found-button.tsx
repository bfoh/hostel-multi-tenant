'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Package, X } from 'lucide-react'

export function LogLostFoundButton() {
  const router = useRouter()
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const [form, setForm] = useState({
    type:           'found',
    item_name:      '',
    description:    '',
    location_found: '',
    found_date:     new Date().toISOString().slice(0, 10),
    owner_name:     '',
    owner_phone:    '',
    room_number:    '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/security/lost-found', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          location_found: form.location_found || null,
          owner_name:     form.owner_name || null,
          owner_phone:    form.owner_phone || null,
          room_number:    form.room_number || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(JSON.stringify(data.error))
      setOpen(false)
      setForm({ type: 'found', item_name: '', description: '', location_found: '', found_date: new Date().toISOString().slice(0, 10), owner_name: '', owner_phone: '', room_number: '' })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
      setSaving(false)
    }
  }

  return (
    <>
      <button onClick={() => { setOpen(true); setError(null) }}
        className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors">
        <Package className="h-4 w-4" /> Log item
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-text-primary">Log lost / found item</h2>
              <button onClick={() => setOpen(false)} className="text-text-disabled hover:text-text-primary transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Type *</label>
                <div className="flex gap-2">
                  {['found', 'lost'].map(t => (
                    <button key={t} type="button" onClick={() => set('type', t)}
                      className={`flex-1 rounded-md border py-2 text-sm font-medium capitalize transition-colors ${form.type === t ? 'border-brand bg-brand text-brand-fg' : 'border-border bg-surface text-text-secondary hover:bg-surface-raised'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Item name *</label>
                <input value={form.item_name} onChange={e => set('item_name', e.target.value)} required
                  className={inputCls} placeholder="e.g. Black Nokia phone" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Description</label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)}
                  className={inputCls} rows={2} placeholder="Identifying features…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Location found</label>
                  <input value={form.location_found} onChange={e => set('location_found', e.target.value)}
                    className={inputCls} placeholder="Block B corridor" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Date</label>
                  <input type="date" value={form.found_date} onChange={e => set('found_date', e.target.value)}
                    className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Owner name</label>
                  <input value={form.owner_name} onChange={e => set('owner_name', e.target.value)}
                    className={inputCls} placeholder="If known" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Owner phone</label>
                  <input value={form.owner_phone} onChange={e => set('owner_phone', e.target.value)}
                    className={inputCls} placeholder="If known" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Room number</label>
                <input value={form.room_number} onChange={e => set('room_number', e.target.value)}
                  className={inputCls} placeholder="e.g. 12A" />
              </div>

              {error && <p className="text-sm text-danger">{error}</p>}

              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setOpen(false)} className={cancelCls}>Cancel</button>
                <button type="submit" disabled={saving} className={submitCls}>
                  {saving ? 'Logging…' : 'Log item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

const inputCls  = 'w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-colors'
const cancelCls = 'rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised transition-colors'
const submitCls = 'rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-50 transition-colors'
