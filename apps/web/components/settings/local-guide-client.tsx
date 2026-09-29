'use client'

import { useState } from 'react'
import { Plus, Loader2, Trash2, UtensilsCrossed, Landmark, Car, ShoppingBag, Siren, MapPin } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface GuideEntry {
  id: string
  category: string
  name: string
  note: string | null
  distance: string | null
  link: string | null
}

const CAT_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  restaurant: { label: 'Restaurant',  icon: UtensilsCrossed },
  attraction: { label: 'Attraction',  icon: Landmark },
  transport:  { label: 'Transport',   icon: Car },
  shopping:   { label: 'Shopping',    icon: ShoppingBag },
  emergency:  { label: 'Emergency',   icon: Siren },
  other:      { label: 'Other',       icon: MapPin },
}

export function LocalGuideClient({ initialEntries }: { initialEntries: GuideEntry[] }) {
  const [entries, setEntries] = useState(initialEntries)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [category, setCategory] = useState('restaurant')
  const [name, setName]         = useState('')
  const [note, setNote]         = useState('')
  const [distance, setDistance] = useState('')
  const [link, setLink]         = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/settings/local-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, name, note: note || null, distance: distance || null, link: link || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setEntries((prev) => [...prev, data])
      setShowForm(false)
      setCategory('restaurant'); setName(''); setNote(''); setDistance(''); setLink('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Remove this entry?')) return
    setDeletingId(id)
    await fetch(`/api/settings/local-guide/${id}`, { method: 'DELETE' })
    setEntries((prev) => prev.filter((e) => e.id !== id))
    setDeletingId(null)
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          Shown as a &quot;Local Guide&quot; tab in your guests&apos; self-service portal during their stay.
        </p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-fg transition-colors hover:bg-brand-hover"
        >
          <Plus className="h-4 w-4" />
          Add place
        </button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Add a place</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    {Object.entries(CAT_CONFIG).map(([v, c]) => (
                      <option key={v} value={v}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={150}
                    placeholder="e.g. Papaye Restaurant"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Distance / directions (optional)</label>
                  <input
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    maxLength={60}
                    placeholder="e.g. 5 min walk"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Link (optional)</label>
                  <input
                    type="url"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://…"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-tertiary">Note (optional)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Anything guests should know…"
                  className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              {error && <p className="text-xs text-danger">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition-colors hover:bg-brand-hover disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised"
                >
                  Cancel
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {entries.length === 0 && !showForm ? (
        <p className="py-12 text-center text-sm text-text-tertiary">No places added yet</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const cfg = CAT_CONFIG[entry.category] ?? CAT_CONFIG.other
            const Icon = cfg.icon
            return (
              <div key={entry.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface p-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-text-primary">{entry.name}</p>
                      <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-text-secondary">{cfg.label}</span>
                    </div>
                    {entry.distance && <p className="mt-0.5 text-xs text-text-tertiary">{entry.distance}</p>}
                    {entry.note && <p className="mt-0.5 text-sm text-text-secondary">{entry.note}</p>}
                  </div>
                </div>
                <button
                  onClick={() => remove(entry.id)}
                  disabled={deletingId === entry.id}
                  className="shrink-0 rounded-md p-1.5 text-text-disabled transition-colors hover:text-danger"
                >
                  {deletingId === entry.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
