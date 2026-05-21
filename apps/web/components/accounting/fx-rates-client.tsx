'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2 } from 'lucide-react'

import { COMMON_FOREIGN_CURRENCIES } from '@/lib/currencies'
import type { FxRate } from '@/lib/data/fx'

export function FxRatesClient({ initialRates }: { initialRates: FxRate[] }) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)

  const [showForm, setShowForm]     = useState(false)
  const [code, setCode]             = useState<string>('USD')
  const [customCode, setCustomCode] = useState('')
  const [rate, setRate]             = useState('')
  const [asOf, setAsOf]             = useState(today)
  const [source, setSource]         = useState('')
  const [notes, setNotes]           = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const finalCode = code === 'custom' ? customCode.trim().toUpperCase() : code

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const num = parseFloat(rate)
    if (!Number.isFinite(num) || num <= 0) {
      setError('Rate must be > 0')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/accounting/fx-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currency_code: finalCode,
          rate_to_base:  num,
          as_of_date:    asOf,
          source:        source.trim() || undefined,
          notes:         notes.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? `Failed (${res.status})`); setSubmitting(false); return }
      setShowForm(false)
      setRate(''); setCustomCode(''); setSource(''); setNotes('')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this FX rate?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/accounting/fx-rates?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? `Failed (${res.status})`)
        return
      }
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">All captured rates</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          New rate
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-[11px] font-medium text-text-secondary mb-1">Currency</label>
              <select
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
              >
                {COMMON_FOREIGN_CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="custom">Other…</option>
              </select>
            </div>
            {code === 'custom' && (
              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1">ISO code</label>
                <input
                  type="text"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  placeholder="e.g. CAD"
                  maxLength={4}
                  className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm uppercase focus:border-brand focus:outline-none"
                />
              </div>
            )}
            <div>
              <label className="block text-[11px] font-medium text-text-secondary mb-1">Rate to GHS</label>
              <input
                type="number"
                step="0.0001"
                min="0.0001"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="e.g. 12.4500"
                required
                className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-right text-sm tabular-nums focus:border-brand focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-text-secondary mb-1">Date</label>
              <input
                type="date"
                value={asOf}
                max={today}
                onChange={(e) => setAsOf(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Source (BoG, GCB, manual…)"
              className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
            />
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
            />
          </div>
          {error && (
            <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-1.5 text-xs text-danger">{error}</p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save rate
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(null) }}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        {initialRates.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-tertiary">No FX rates captured yet.</p>
        ) : (
          <table className="w-full min-w-[700px]">
            <thead className="bg-surface-raised">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary w-24">Currency</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-32">Rate (GHS)</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary w-32">As of</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary">Source</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary">Notes</th>
                <th className="px-4 py-2.5 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {initialRates.map((r) => (
                <tr key={r.id} className="hover:bg-surface-raised/50 transition-colors">
                  <td className="px-4 py-2.5 text-sm font-semibold text-text-primary">{r.currency_code}</td>
                  <td className="px-4 py-2.5 text-right text-sm tabular-nums text-text-primary">{r.rate_to_base.toFixed(4)}</td>
                  <td className="px-4 py-2.5 text-xs text-text-secondary">
                    {new Date(r.as_of_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-text-secondary">{r.source ?? '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-text-tertiary truncate max-w-xs">{r.notes ?? ''}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      disabled={deletingId === r.id}
                      aria-label="Delete rate"
                      className="rounded p-1 text-text-tertiary hover:bg-danger/10 hover:text-danger disabled:opacity-50 transition-colors"
                    >
                      {deletingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
