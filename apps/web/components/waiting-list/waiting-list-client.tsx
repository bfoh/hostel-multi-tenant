'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Check, Bell, Loader2, Users, CalendarClock, Globe, Mail, Phone, MessageSquare } from 'lucide-react'

interface Category { id: string; name: string }
interface WLEntry {
  id: string
  status: string
  priority: number
  source: 'manual' | 'website' | 'whatsapp' | 'referral'
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  preferred_check_in: string | null
  preferred_duration: string | null
  notes: string | null
  message: string | null
  notified_at: string | null
  created_at: string
  room_categories?: { name: string } | null
  occupants?: { first_name: string; last_name: string; phone?: string; email?: string } | null
}

const SOURCE_LABEL: Record<WLEntry['source'], string> = {
  manual:   'Walk-in / Staff',
  website:  'Website',
  whatsapp: 'WhatsApp',
  referral: 'Referral',
}

const SOURCE_BADGE: Record<WLEntry['source'], string> = {
  manual:   'bg-surface-raised text-text-secondary border-border',
  website:  'bg-brand/10 text-brand border-brand/30',
  whatsapp: 'bg-success-subtle text-success border-success/20',
  referral: 'bg-info-subtle text-info border-info/20',
}

const STATUS_BADGE: Record<string, string> = {
  waiting: 'bg-warning-subtle text-warning-fg border-warning/20',
  offered: 'bg-info-subtle text-info border-info/20',
}

export function WaitingListClient({
  initialEntries,
  categories,
  initialSource = 'all',
}: {
  initialEntries: WLEntry[]
  categories: Category[]
  initialSource?: string
}) {
  const router  = useRouter()
  const [entries, setEntries] = useState(initialEntries)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [sourceFilter, setSourceFilter] = useState<string>(initialSource)

  const sourceCounts = useMemo(() => {
    const c: Record<string, number> = { all: entries.length, website: 0, manual: 0, whatsapp: 0, referral: 0 }
    for (const e of entries) c[e.source] = (c[e.source] ?? 0) + 1
    return c
  }, [entries])

  const visibleEntries = useMemo(
    () => sourceFilter === 'all' ? entries : entries.filter((e) => e.source === sourceFilter),
    [entries, sourceFilter],
  )

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
    setError(null)
    try {
      const res = await fetch(`/api/waiting-list/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Failed (${res.status})`)
      }
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)))
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setActingId(null)
    }
  }

  async function markNotified(id: string) {
    setActingId(id)
    setError(null)
    try {
      const notified_at = new Date().toISOString()
      const res = await fetch(`/api/waiting-list/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notified_at }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Failed (${res.status})`)
      }
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, notified_at } : e)))
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setActingId(null)
    }
  }

  async function remove(id: string) {
    if (!confirm('Remove this entry from the waiting list?')) return
    setActingId(id)
    setError(null)
    try {
      const res = await fetch(`/api/waiting-list/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Failed (${res.status})`)
      }
      setEntries((prev) => prev.filter((e) => e.id !== id))
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Waiting List & Enquiries</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {entries.length} open · {sourceCounts.website ?? 0} from website
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

      {error && !showForm && (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger flex items-start justify-between gap-3">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-danger/70 hover:text-danger text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Source filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(['all', 'website', 'manual', 'whatsapp', 'referral'] as const).map((s) => {
          const count = sourceCounts[s] ?? 0
          const active = sourceFilter === s
          const label = s === 'all' ? 'All' : SOURCE_LABEL[s as WLEntry['source']]
          return (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'bg-brand text-brand-fg border-brand'
                  : 'bg-surface border-border text-text-secondary hover:text-text-primary hover:border-brand/40'
              }`}
            >
              {s === 'website' && <Globe className="h-3 w-3" />}
              {label}
              <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-brand-fg/15 text-brand-fg' : 'bg-surface-raised text-text-tertiary'}`}>
                {count}
              </span>
            </button>
          )
        })}
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
      {visibleEntries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <Users className="h-8 w-8 text-text-disabled" />
          <p className="font-medium text-text-primary">
            {sourceFilter === 'website' ? 'No website enquiries yet' : 'No one on the waiting list'}
          </p>
          <p className="text-sm text-text-secondary">
            {sourceFilter === 'website'
              ? 'New enquiries submitted from your public website will show up here.'
              : 'Add people who are waiting for a room to become available.'}
          </p>
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
            {visibleEntries.map((entry, i) => {
              const occ = Array.isArray(entry.occupants) ? entry.occupants[0] : entry.occupants
              const cat = Array.isArray(entry.room_categories) ? entry.room_categories[0] : entry.room_categories
              const name = occ ? `${occ.first_name} ${occ.last_name}` : entry.contact_name
              const phone = occ?.phone ?? entry.contact_phone
              const email = occ?.email ?? entry.contact_email
              const loading = actingId === entry.id
              const isWeb = entry.source === 'website'

              return (
                <div key={entry.id} className="grid grid-cols-[auto_1fr_auto_auto] gap-4 items-start px-4 py-3">
                  <span className="text-sm font-bold text-text-tertiary w-6 text-center pt-0.5">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-text-primary">{name}</p>
                      <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${SOURCE_BADGE[entry.source]}`}>
                        {isWeb && <Globe className="inline h-2.5 w-2.5 mr-0.5 -mt-0.5" />}
                        {SOURCE_LABEL[entry.source]}
                      </span>
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
                      {phone && (
                        <a href={`tel:${phone}`} className="inline-flex items-center gap-1 hover:text-text-primary">
                          <Phone className="h-3 w-3" />
                          {phone}
                        </a>
                      )}
                      {email && (
                        <a href={`mailto:${email}`} className="inline-flex items-center gap-1 hover:text-text-primary">
                          <Mail className="h-3 w-3" />
                          {email}
                        </a>
                      )}
                      {entry.preferred_check_in && (
                        <span className="flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          From {entry.preferred_check_in}
                        </span>
                      )}
                      {entry.notified_at && (
                        <span className="text-success">Notified {new Date(entry.notified_at).toLocaleDateString('en-GH', { dateStyle: 'short' })}</span>
                      )}
                    </div>
                    {entry.message && (
                      <div className="mt-2 rounded-md border border-border bg-surface-raised/40 px-3 py-2">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-text-tertiary mb-1">
                          <MessageSquare className="h-3 w-3" />
                          Enquiry message
                        </div>
                        <p className="text-xs text-text-secondary whitespace-pre-wrap">{entry.message}</p>
                      </div>
                    )}
                    {entry.notes && (
                      <p className="mt-1 text-xs text-text-tertiary">Note: {entry.notes}</p>
                    )}
                  </div>
                  <span className="text-xs text-text-tertiary pt-0.5">{cat?.name ?? 'Any'}</span>
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
