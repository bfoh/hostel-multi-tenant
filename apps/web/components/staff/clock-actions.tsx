'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn, LogOut, X } from 'lucide-react'

interface StaffOption {
  id: string
  first_name: string
  last_name: string
  job_title?: string | null
}

export function ClockActions({ staff }: { staff: StaffOption[] }) {
  const router = useRouter()
  const [modal, setModal] = useState<'in' | 'out' | null>(null)
  const [staffId, setStaffId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)

  async function submit() {
    if (!staffId) { setError('Please select a staff member'); return }
    setSaving(true)
    setError(null)
    try {
      const method = modal === 'in' ? 'POST' : 'PATCH'
      const res = await fetch(`/api/staff/${staffId}/attendance`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(JSON.stringify(data.error))
      setModal(null)
      setStaffId('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
      setSaving(false)
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => { setModal('in'); setError(null) }}
          className="flex items-center gap-1.5 rounded-md bg-success px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          <LogIn className="h-4 w-4" /> Clock in
        </button>
        <button
          onClick={() => { setModal('out'); setError(null) }}
          className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-raised transition-colors"
        >
          <LogOut className="h-4 w-4" /> Clock out
        </button>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-text-primary">
                {modal === 'in' ? 'Clock In' : 'Clock Out'} — {new Date().toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })}
              </h2>
              <button onClick={() => setModal(null)} className="text-text-disabled hover:text-text-primary transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Staff member</label>
                <select
                  value={staffId}
                  onChange={e => setStaffId(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-colors"
                >
                  <option value="">Select staff…</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>{s.first_name} {s.last_name}{s.job_title ? ` — ${s.job_title}` : ''}</option>
                  ))}
                </select>
              </div>

              {error && (
                <p className="text-sm text-danger">{error}</p>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={saving}
                  className={`rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${modal === 'in' ? 'bg-success hover:opacity-90' : 'bg-brand hover:bg-brand-hover'}`}
                >
                  {saving ? 'Saving…' : modal === 'in' ? 'Confirm clock in' : 'Confirm clock out'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
