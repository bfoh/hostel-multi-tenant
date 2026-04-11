'use client'

import { useState } from 'react'
import { ShieldX, ShieldOff, Trash2, Loader2, AlertTriangle, UserX } from 'lucide-react'
import { initials } from '@/lib/utils'

interface BlacklistEntry {
  id: string
  occupant_id?: string | null
  phone?: string | null
  reason: string
  severity: 'warning' | 'banned'
  is_active: boolean
  expires_at?: string | null
  created_at: string
  occupants?: { first_name: string; last_name: string; phone?: string; email?: string; photo_url?: string } | null
}

const SEV_STYLES = {
  banned:  { cls: 'bg-danger-subtle text-danger border-danger/20',   label: 'Banned',  icon: ShieldX },
  warning: { cls: 'bg-warning-subtle text-warning-fg border-warning/20', label: 'Warning', icon: AlertTriangle },
}

export function BlacklistClient({ initialEntries }: { initialEntries: BlacklistEntry[] }) {
  const [entries, setEntries] = useState(initialEntries)
  const [showAll, setShowAll] = useState(false)
  const [saving, setSaving]   = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  // New entry form
  const [phone, setPhone]       = useState('')
  const [reason, setReason]     = useState('')
  const [severity, setSeverity] = useState<'warning' | 'banned'>('banned')
  const [expiresAt, setExpiresAt] = useState('')
  const [adding, setAdding]     = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const displayed = showAll ? entries : entries.filter((e) => e.is_active)

  async function lift(id: string) {
    setSaving(id); setError(null)
    try {
      const res = await fetch(`/api/blacklist/${id}`, { method: 'PATCH' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setEntries((prev) => prev.map((e) => e.id === id ? { ...e, is_active: false } : e))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(null)
    }
  }

  async function remove(id: string) {
    setSaving(id); setError(null)
    try {
      const res = await fetch(`/api/blacklist/${id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed') }
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(null)
    }
  }

  async function addEntry() {
    if (!phone && !reason) { setFormError('Phone and reason required'); return }
    if (!phone) { setFormError('Phone number required for manual entries'); return }
    if (!reason) { setFormError('Reason required'); return }
    setAdding(true); setFormError(null)
    try {
      const res = await fetch('/api/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          reason,
          severity,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setEntries((prev) => [data, ...prev])
      setShowForm(false)
      setPhone(''); setReason(''); setSeverity('banned'); setExpiresAt('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="rounded"
          />
          Show lifted entries
        </label>
        <button
          onClick={() => { setShowForm((p) => !p); setFormError(null) }}
          className="text-sm font-medium text-brand hover:underline"
        >
          {showForm ? 'Cancel' : '+ Add by phone'}
        </button>
      </div>

      {/* Add form (for non-occupant blacklisting by phone) */}
      {showForm && (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <p className="text-sm font-medium text-text-primary">Blacklist phone number</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-text-tertiary">Phone number</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+233..."
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-tertiary">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as 'warning' | 'banned')}
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="banned">Banned</option>
                <option value="warning">Warning only</option>
              </select>
            </div>
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for blacklisting..."
            rows={2}
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand resize-none"
          />
          <div>
            <label className="mb-1 block text-xs text-text-tertiary">Expires (leave blank for permanent)</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          {formError && <p className="text-xs text-danger">{formError}</p>}
          <button
            onClick={addEntry}
            disabled={adding}
            className="flex items-center gap-2 rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/90 transition-colors disabled:opacity-60"
          >
            {adding && <Loader2 className="h-4 w-4 animate-spin" />}
            <UserX className="h-4 w-4" />
            Blacklist
          </button>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* List */}
      {displayed.length === 0 ? (
        <p className="py-16 text-center text-sm text-text-tertiary">No blacklist entries</p>
      ) : (
        <div className="space-y-2">
          {displayed.map((entry) => {
            const occ  = entry.occupants
            const name = occ ? `${occ.first_name} ${occ.last_name}` : entry.phone ?? 'Unknown'
            const sev  = SEV_STYLES[entry.severity]
            const Icon = sev.icon
            const isExpired = entry.expires_at && new Date(entry.expires_at) < new Date()

            return (
              <div
                key={entry.id}
                className={`rounded-xl border bg-surface p-4 ${!entry.is_active || isExpired ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-subtle text-sm font-semibold text-danger">
                    {occ?.photo_url
                      ? <img src={occ.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                      : initials(name)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-text-primary text-sm">{name}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${sev.cls}`}>
                        <Icon className="inline h-3 w-3 mr-0.5" />{sev.label}
                      </span>
                      {!entry.is_active && (
                        <span className="rounded-full border border-border bg-surface-sunken px-2 py-0.5 text-[11px] text-text-tertiary">
                          Lifted
                        </span>
                      )}
                      {isExpired && (
                        <span className="rounded-full border border-border bg-surface-sunken px-2 py-0.5 text-[11px] text-text-tertiary">
                          Expired
                        </span>
                      )}
                    </div>
                    {occ && <p className="text-xs text-text-tertiary mt-0.5">{occ.phone ?? occ.email}</p>}
                    <p className="mt-1 text-sm text-text-secondary">{entry.reason}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-text-tertiary">
                      <span>Added {new Date(entry.created_at).toLocaleDateString()}</span>
                      {entry.expires_at && (
                        <span>Expires {new Date(entry.expires_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  {entry.is_active && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => lift(entry.id)}
                        disabled={saving === entry.id}
                        title="Lift ban"
                        className="rounded-md p-1.5 text-text-tertiary hover:text-success transition-colors disabled:opacity-60"
                      >
                        {saving === entry.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => remove(entry.id)}
                        disabled={saving === entry.id}
                        title="Delete entry"
                        className="rounded-md p-1.5 text-text-tertiary hover:text-danger transition-colors disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
