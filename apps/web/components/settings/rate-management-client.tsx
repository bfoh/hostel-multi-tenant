'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Loader2, CalendarRange, Tag } from 'lucide-react'

interface Category { id: string; name: string; base_price: number }
interface RateOverride {
  id: string
  name: string
  category_id: string | null
  rate_type: 'fixed' | 'percent_add' | 'percent_off'
  value: number
  starts_on: string
  ends_on: string
  is_active: boolean
  notes: string | null
  room_categories?: { id: string; name: string } | null
}

const RATE_TYPE_LABELS: Record<string, string> = {
  fixed:       'Fixed price (GHS)',
  percent_add: 'Markup (%)',
  percent_off: 'Discount (%)',
}

function formatRate(r: RateOverride) {
  if (r.rate_type === 'fixed')       return `GHS ${r.value.toFixed(2)}`
  if (r.rate_type === 'percent_add') return `+${r.value}%`
  if (r.rate_type === 'percent_off') return `-${r.value}%`
  return `${r.value}`
}

interface FormState {
  name: string
  category_id: string
  rate_type: string
  value: string
  starts_on: string
  ends_on: string
  notes: string
}

const EMPTY_FORM: FormState = {
  name: '', category_id: '', rate_type: 'fixed',
  value: '', starts_on: '', ends_on: '', notes: '',
}

export function RateManagementClient({
  initialRates,
  categories,
}: {
  initialRates: RateOverride[]
  categories: Category[]
}) {
  const router = useRouter()
  const [rates, setRates]   = useState(initialRates)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<RateOverride | null>(null)
  const [form, setForm]         = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError(null)
    setShowForm(true)
  }

  function openEdit(r: RateOverride) {
    setEditing(r)
    setForm({
      name:        r.name,
      category_id: r.category_id ?? '',
      rate_type:   r.rate_type,
      value:       String(r.value),
      starts_on:   r.starts_on,
      ends_on:     r.ends_on,
      notes:       r.notes ?? '',
    })
    setError(null)
    setShowForm(true)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name:        form.name,
        category_id: form.category_id || null,
        rate_type:   form.rate_type,
        value:       parseFloat(form.value),
        starts_on:   form.starts_on,
        ends_on:     form.ends_on,
        notes:       form.notes || null,
      }
      let res: Response
      if (editing) {
        res = await fetch(`/api/rates/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/rates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      setShowForm(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(r: RateOverride) {
    await fetch(`/api/rates/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !r.is_active }),
    })
    router.refresh()
  }

  async function deleteRate(id: string) {
    if (!confirm('Delete this rate override?')) return
    setDeletingId(id)
    await fetch(`/api/rates/${id}`, { method: 'DELETE' })
    setDeletingId(null)
    router.refresh()
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Rate Management</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            Seasonal pricing, promotions, and date-range rate overrides
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
        >
          <Plus className="h-4 w-4" />
          New rate
        </button>
      </div>

      {/* Base rates info */}
      {categories.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Tag className="h-4 w-4 text-text-tertiary" />
            Base Rates (room categories)
          </h2>
          <div className="flex flex-wrap gap-3">
            {categories.map((c) => (
              <div key={c.id} className="rounded-lg border border-border bg-surface-raised px-3 py-2">
                <p className="text-xs font-medium text-text-primary">{c.name}</p>
                <p className="text-xs text-text-tertiary font-mono">
                  GHS {c.base_price?.toFixed(2) ?? '—'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rate override form */}
      {showForm && (
        <div className="rounded-xl border border-brand/30 bg-brand/5 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary">
            {editing ? 'Edit Rate Override' : 'New Rate Override'}
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-text-secondary mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Christmas Holiday 2025"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Room Category <span className="text-text-tertiary">(leave blank for all)</span>
              </label>
              <select
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Rate type</label>
              <select
                value={form.rate_type}
                onChange={(e) => setForm({ ...form, rate_type: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              >
                {Object.entries(RATE_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Value {form.rate_type === 'fixed' ? '(GHS)' : '(%)'}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder="0.00"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Start date</label>
              <input
                type="date"
                min={today}
                value={form.starts_on}
                onChange={(e) => setForm({ ...form, starts_on: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">End date</label>
              <input
                type="date"
                min={form.starts_on || today}
                value={form.ends_on}
                onChange={(e) => setForm({ ...form, ends_on: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-text-secondary mb-1">Notes (optional)</label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Internal notes…"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-danger">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-md border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rate overrides list */}
      {rates.length === 0 && !showForm ? (
        <div className="rounded-xl border border-dashed border-border py-14 text-center">
          <CalendarRange className="mx-auto h-8 w-8 text-text-disabled mb-3" />
          <p className="font-medium text-text-primary">No rate overrides yet</p>
          <p className="mt-1 text-sm text-text-secondary">
            Create seasonal pricing or promotions to override your base rates for specific date ranges.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="border-b border-border px-4 py-3 bg-surface-raised flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Rate Overrides</h2>
            <span className="text-xs text-text-tertiary">{rates.length} override{rates.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-border">
            {rates.map((r) => {
              const cat = Array.isArray(r.room_categories) ? r.room_categories[0] : r.room_categories
              const isActive = r.is_active && r.ends_on >= today && r.starts_on <= today
              const isFuture = r.starts_on > today
              const isPast   = r.ends_on < today

              return (
                <div key={r.id} className={`flex items-center gap-3 px-4 py-3 ${!r.is_active || isPast ? 'opacity-50' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-text-primary">{r.name}</p>
                      {isActive && (
                        <span className="rounded-full bg-success/10 text-success text-[10px] font-semibold px-1.5 py-0.5">
                          Active now
                        </span>
                      )}
                      {isFuture && r.is_active && (
                        <span className="rounded-full bg-info/10 text-info text-[10px] font-semibold px-1.5 py-0.5">
                          Upcoming
                        </span>
                      )}
                      {isPast && (
                        <span className="rounded-full bg-surface-sunken text-text-tertiary text-[10px] font-medium px-1.5 py-0.5">
                          Expired
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-text-tertiary flex-wrap">
                      <span className="font-mono font-semibold text-text-primary">{formatRate(r)}</span>
                      <span>{cat?.name ?? 'All categories'}</span>
                      <span className="flex items-center gap-1">
                        <CalendarRange className="h-3 w-3" />
                        {r.starts_on} → {r.ends_on}
                      </span>
                      {r.notes && <span className="truncate max-w-[150px]">{r.notes}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleActive(r)}
                      className="p-1.5 text-text-tertiary hover:text-text-primary transition-colors"
                      title={r.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {r.is_active
                        ? <ToggleRight className="h-5 w-5 text-success" />
                        : <ToggleLeft className="h-5 w-5" />}
                    </button>
                    <button
                      onClick={() => openEdit(r)}
                      className="p-1.5 text-text-tertiary hover:text-text-primary transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteRate(r.id)}
                      disabled={deletingId === r.id}
                      className="p-1.5 text-text-tertiary hover:text-danger transition-colors"
                    >
                      {deletingId === r.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
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
