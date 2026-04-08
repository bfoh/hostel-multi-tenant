'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'

export function RunPayrollButton() {
  const router  = useRouter()
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // Default to current month
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate()

  const [form, setForm] = useState({
    period_start: `${y}-${m}-01`,
    period_end:   `${y}-${m}-${lastDay}`,
    notes:        '',
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error))
      setOpen(false)
      router.push(`/staff/payroll/${data.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run payroll')
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setError(null) }}
        className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
      >
        <Plus className="h-4 w-4" /> Run payroll
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-text-primary">Run payroll</h2>
              <button onClick={() => setOpen(false)} className="text-text-disabled hover:text-text-primary transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Period start *</label>
                  <input type="date" value={form.period_start}
                    onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))}
                    required className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Period end *</label>
                  <input type="date" value={form.period_end}
                    onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))}
                    required className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className={inputCls} placeholder="e.g. April 2026 payroll" />
              </div>

              <p className="text-xs text-text-tertiary">
                This will generate payroll items for all active staff using their current basic salary,
                applying Ghana PAYE and SSNIT calculations.
              </p>

              {error && <p className="text-sm text-danger">{error}</p>}

              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setOpen(false)}
                  className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-50 transition-colors">
                  {saving ? 'Running…' : 'Run payroll'}
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
