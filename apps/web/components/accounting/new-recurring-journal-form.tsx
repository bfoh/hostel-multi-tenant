'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2 } from 'lucide-react'

interface AccountOption {
  id:   string
  code: string
  name: string
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
}

interface Line {
  account_id:  string
  side:        'debit' | 'credit'
  amount:      string
  description: string
}

function emptyLine(side: 'debit' | 'credit' = 'debit'): Line {
  return { account_id: '', side, amount: '', description: '' }
}

function toPesewas(g: string) {
  const n = parseFloat(g)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0
}

function fmt(p: number) {
  return (p / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function NewRecurringJournalForm({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter()
  const today = new Date()
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString().slice(0, 10)

  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [frequency, setFrequency]     = useState<'monthly' | 'quarterly' | 'yearly'>('monthly')
  const [dayOfMonth, setDayOfMonth]   = useState('1')
  const [nextRun, setNextRun]         = useState(nextMonth)
  const [lines, setLines]             = useState<Line[]>([emptyLine('debit'), emptyLine('credit')])
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const totals = useMemo(() => {
    let d = 0, c = 0
    for (const l of lines) {
      const p = toPesewas(l.amount)
      if (l.side === 'debit') d += p; else c += p
    }
    return { d, c, balanced: d === c && d > 0 }
  }, [lines])

  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  const addLine = (side: 'debit' | 'credit') => setLines((prev) => [...prev, emptyLine(side)])
  const removeLine = (i: number) => setLines((prev) => prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim() || !description.trim()) { setError('Name and description required'); return }
    if (!totals.balanced) {
      setError(`Debits (${fmt(totals.d)}) must equal credits (${fmt(totals.c)})`); return
    }
    for (const [i, l] of lines.entries()) {
      if (!l.account_id) { setError(`Line ${i + 1}: select an account`); return }
      if (toPesewas(l.amount) <= 0) { setError(`Line ${i + 1}: amount must be > 0`); return }
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/accounting/recurring/journals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:          name.trim(),
          description:   description.trim(),
          frequency,
          day_of_month:  parseInt(dayOfMonth, 10),
          next_run_date: nextRun,
          lines: lines.map((l) => ({
            account_id:  l.account_id,
            side:        l.side,
            amount:      toPesewas(l.amount),
            description: l.description.trim() || undefined,
          })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? `Failed (${res.status})`); setSubmitting(false); return }
      router.push('/accounting/recurring')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Template name *</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)} required
              placeholder="e.g. Monthly prepaid insurance amortization"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Entry description *</label>
            <input
              type="text" value={description} onChange={(e) => setDescription(e.target.value)} required
              placeholder="Used on every generated entry"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Frequency</label>
            <select
              value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Day of month</label>
            <input
              type="number" min="1" max="31" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-right text-sm tabular-nums focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">First run</label>
            <input
              type="date" value={nextRun} onChange={(e) => setNextRun(e.target.value)} required
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="border-b border-border bg-surface-raised px-4 py-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Lines</h2>
        </div>
        <div className="divide-y divide-border/40">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-start p-3">
              <select
                value={line.account_id}
                onChange={(e) => updateLine(i, { account_id: e.target.value })}
                required
                className="col-span-5 rounded-lg border border-border bg-surface px-2.5 py-2 text-sm focus:border-brand focus:outline-none"
              >
                <option value="">Select account…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                ))}
              </select>
              <div className="col-span-2 flex rounded-lg border border-border overflow-hidden text-xs font-medium">
                <button
                  type="button"
                  onClick={() => updateLine(i, { side: 'debit' })}
                  className={`flex-1 py-2 transition-colors ${line.side === 'debit' ? 'bg-brand text-white' : 'bg-surface text-text-secondary hover:bg-surface-raised'}`}
                >
                  Debit
                </button>
                <button
                  type="button"
                  onClick={() => updateLine(i, { side: 'credit' })}
                  className={`flex-1 py-2 transition-colors ${line.side === 'credit' ? 'bg-brand text-white' : 'bg-surface text-text-secondary hover:bg-surface-raised'}`}
                >
                  Credit
                </button>
              </div>
              <input
                type="number" step="0.01" min="0" value={line.amount}
                onChange={(e) => updateLine(i, { amount: e.target.value })}
                placeholder="0.00" required
                className="col-span-2 rounded-lg border border-border bg-surface px-2.5 py-2 text-right text-sm tabular-nums focus:border-brand focus:outline-none"
              />
              <input
                type="text" value={line.description}
                onChange={(e) => updateLine(i, { description: e.target.value })}
                placeholder="Memo"
                className="col-span-2 rounded-lg border border-border bg-surface px-2.5 py-2 text-sm focus:border-brand focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removeLine(i)}
                disabled={lines.length <= 2}
                aria-label="Remove"
                className="col-span-1 flex items-center justify-center rounded-lg border border-border bg-surface p-2 text-text-tertiary hover:bg-danger/10 hover:text-danger disabled:opacity-30 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="border-t border-border bg-surface-raised px-3 py-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => addLine('debit')}  className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"><Plus className="h-3 w-3" /> Add debit</button>
          <button type="button" onClick={() => addLine('credit')} className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"><Plus className="h-3 w-3" /> Add credit</button>
        </div>
        <div className="border-t border-border bg-surface px-4 py-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div><p className="text-xs text-text-tertiary">Debits</p><p className="mt-1 font-semibold text-text-primary tabular-nums">GH₵ {fmt(totals.d)}</p></div>
          <div><p className="text-xs text-text-tertiary">Credits</p><p className="mt-1 font-semibold text-text-primary tabular-nums">GH₵ {fmt(totals.c)}</p></div>
          <div><p className="text-xs text-text-tertiary">Balanced</p><p className={`mt-1 font-semibold ${totals.balanced ? 'text-success' : 'text-danger'}`}>{totals.balanced ? 'Yes' : `Off by ${fmt(Math.abs(totals.d - totals.c))}`}</p></div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting || !totals.balanced}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Create template
        </button>
      </div>
    </form>
  )
}
