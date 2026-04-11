'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Check, Bell, Loader2, Users, CalendarClock } from 'lucide-react'

interface Category { id: string; name: string }
interface WLEntry {
  id: string
  status: string
  priority: number
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  preferred_check_in: string | null
  preferred_duration: string | null
  notes: string | null
  notified_at: string | null
  created_at: string
  room_categories?: { name: string } | null
  occupants?: { first_name: string; last_name: string; phone?: string; email?: string } | null
}

const STATUS_BADGE: Record<string, string> = {
  waiting: 'bg-warning-subtle text-warning-fg border-warning/20',
  offered: 'bg-info-subtle text-info border-info/20',
}

export function WaitingListClient({
  initialEntries,
  categories,
}: {
  initialEntries: WLEntry[]
  categories: Category[]
}) {
  const router  = useRouter()
  const [entries, setEntries] = useState(initialEntries)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)

  const [form, setForm] = useState({
    contact_name:      '',
    contact_phone:     '',
    contact_email:     '',
    category_id:       '',
    preferred_check_in:'',
    preferred_duration:'',
    notes:             '',
    priority:          '0',
  })

  function resetForm() {
    setForm({ contact_name: '', contact_phone: '', contact_email: '',
              category_id: '', preferred_check_in: '', preferred_duration: '',
              notes: '', priority: '0' })
  }

  async function addEntry() {
    if (!form.contact_name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/waiting-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          category_id: form.category_id || null,
          priority: parseInt(form.priority) || 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setShowForm(false)
      resetForm()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(id: string, status: string) {
    setActingId(id)
    await fetch(`/api/waiting-list/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setActingId(null)
    router.refresh()
  }

  async function markNotified(id: string) {
    setActingId(id)
    await fetch(`/api/waiting-list/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notified_at: new Date().toISOString() }),
    })
    setActingId(null)
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('Remove this entry from the waiting list?')) return
    setActingId(id)
    await fetch(`/api/waiting-list/${id}`, { method: 'DELETE' })
    setActingId(null)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Waiting List</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {entries.length} {entries.length === 1 ? 'person' : 'people'} waiting for a room
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(null) }}
          className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add to list
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="rounded-xl border border-brand/30 bg-brand/5 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary">New waiting list entry</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Full name *</label>
              <input
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                placeholder="e.g. Kwame Mensah"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Phone</label>
              <input
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                placeholder="0241234567"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Email</label>
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                placeholder="kwame@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Room category</label>
              <select
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="">Any category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Preferred check-in</label>
              <input
                type="date"
                value={form.preferred_check_in}
                onChange={(e) => setForm({ ...form, preferred_check_in: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Priority (0–10)</label>
              <input
                type="number"
                min={0}
                max={10}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-text-secondary mb-1">Notes</label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                placeholder="Any special requirements…"
              />
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={addEntry}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Adding…' : 'Add to list'}
            </button>
            <button
              onClick={() => { setShowForm(false); resetForm() }}
              className="rounded-md border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <Users className="h-8 w-8 text-text-disabled" />
          <p className="font-medium text-text-primary">No one on the waiting list</p>
          <p className="text-sm text-text-secondary">Add people who are waiting for a room to become available.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="border-b border-border px-4 py-3 bg-surface-raised text-xs font-semibold uppercase tracking-wide text-text-tertiary grid grid-cols-[auto_1fr_auto_auto] gap-4">
            <span>#</span>
            <span>Contact</span>
            <span>Category</span>
            <span>Actions</span>
          </div>
          <div className="divide-y divide-border">
            {entries.map((entry, i) => {
              const occ = Array.isArray(entry.occupants) ? entry.occupants[0] : entry.occupants
              const cat = Array.isArray(entry.room_categories) ? entry.room_categories[0] : entry.room_categories
              const name = occ ? `${occ.first_name} ${occ.last_name}` : entry.contact_name
              const phone = occ?.phone ?? entry.contact_phone
              const loading = actingId === entry.id

              return (
                <div key={entry.id} className="grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center px-4 py-3">
                  <span className="text-sm font-bold text-text-tertiary w-6 text-center">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-text-primary">{name}</p>
                      <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE[entry.status] ?? 'bg-surface-raised text-text-secondary border-border'}`}>
                        {entry.status}
                      </span>
                      {entry.priority > 0 && (
                        <span className="text-[10px] font-semibold text-warning-fg bg-warning-subtle px-1.5 py-0.5 rounded-full">
                          P{entry.priority}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-tertiary mt-0.5 flex-wrap">
                      {phone && <span>{phone}</span>}
                      {entry.preferred_check_in && (
                        <span className="flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          From {entry.preferred_check_in}
                        </span>
                      )}
                      {entry.notes && <span className="truncate max-w-[200px]">{entry.notes}</span>}
                      {entry.notified_at && (
                        <span className="text-success">Notified {new Date(entry.notified_at).toLocaleDateString('en-GH', { dateStyle: 'short' })}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-text-tertiary">{cat?.name ?? 'Any'}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
                    ) : (
                      <>
                        {!entry.notified_at && (
                          <button
                            onClick={() => markNotified(entry.id)}
                            title="Mark as notified"
                            className="p-1.5 text-text-tertiary hover:text-info transition-colors"
                          >
                            <Bell className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {entry.status === 'waiting' && (
                          <button
                            onClick={() => updateStatus(entry.id, 'offered')}
                            title="Mark as offered a room"
                            className="p-1.5 text-text-tertiary hover:text-success transition-colors"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => remove(entry.id)}
                          title="Remove"
                          className="p-1.5 text-text-tertiary hover:text-danger transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
