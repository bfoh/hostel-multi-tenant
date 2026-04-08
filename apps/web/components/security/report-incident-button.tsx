'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, X } from 'lucide-react'

export function ReportIncidentButton() {
  const router = useRouter()
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const [form, setForm] = useState({
    title:            '',
    description:      '',
    severity:         'medium',
    location:         '',
    involved_parties: '',
    action_taken:     '',
    police_ref:       '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/security/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, location: form.location || null, involved_parties: form.involved_parties || null, action_taken: form.action_taken || null, police_ref: form.police_ref || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(JSON.stringify(data.error))
      setOpen(false)
      setForm({ title: '', description: '', severity: 'medium', location: '', involved_parties: '', action_taken: '', police_ref: '' })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
      setSaving(false)
    }
  }

  return (
    <>
      <button onClick={() => { setOpen(true); setError(null) }}
        className="flex items-center gap-1.5 rounded-md bg-danger px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity">
        <AlertTriangle className="h-4 w-4" /> Report incident
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-text-primary">Report incident</h2>
              <button onClick={() => setOpen(false)} className="text-text-disabled hover:text-text-primary transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Title *</label>
                <input value={form.title} onChange={e => set('title', e.target.value)} required
                  className={inputCls} placeholder="Brief incident title" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Severity *</label>
                  <select value={form.severity} onChange={e => set('severity', e.target.value)} className={inputCls}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Location</label>
                  <input value={form.location} onChange={e => set('location', e.target.value)}
                    className={inputCls} placeholder="Block A corridor" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Description *</label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)} required
                  className={inputCls} rows={4} placeholder="Detailed description of what happened…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Involved parties</label>
                <input value={form.involved_parties} onChange={e => set('involved_parties', e.target.value)}
                  className={inputCls} placeholder="Names / Room numbers" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Action taken</label>
                <textarea value={form.action_taken} onChange={e => set('action_taken', e.target.value)}
                  className={inputCls} rows={2} placeholder="Steps taken to resolve…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Police reference</label>
                <input value={form.police_ref} onChange={e => set('police_ref', e.target.value)}
                  className={inputCls} placeholder="GP/ACC/123/2026" />
              </div>

              {error && <p className="text-sm text-danger">{error}</p>}

              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setOpen(false)} className={cancelCls}>Cancel</button>
                <button type="submit" disabled={saving} className="rounded-md bg-danger px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {saving ? 'Reporting…' : 'Submit report'}
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
