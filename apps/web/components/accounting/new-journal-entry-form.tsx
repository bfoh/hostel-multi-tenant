'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface AccountOption {
  id:    string
  code:  string
  name:  string
  type:  'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
}

interface Line {
  account_id:  string
  side:        'debit' | 'credit'
  amount:      string   // GHS string from input
  description: string
}

function emptyLine(side: 'debit' | 'credit' = 'debit'): Line {
  return { account_id: '', side, amount: '', description: '' }
}

function toPesewas(ghs: string): number {
  const n = parseFloat(ghs)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n * 100)
}

function fmtPesewas(p: number): string {
  return (p / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function NewJournalEntryForm({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)

  const [entryDate, setEntryDate]     = useState(today)
  const [description, setDescription] = useState('')
  const [reference, setReference]     = useState('')
  const [lines, setLines]             = useState<Line[]>([emptyLine('debit'), emptyLine('credit')])
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const totals = useMemo(() => {
    let d = 0, c = 0
    for (const l of lines) {
      const p = toPesewas(l.amount)
      if (l.side === 'debit')  d += p
      else                     c += p
    }
    return { debit: d, credit: c, balanced: d === c && d > 0 }
  }, [lines])

  const updateLine = (i: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  }

  const addLine = (side: 'debit' | 'credit') => {
    setLines((prev) => [...prev, emptyLine(side)])
  }

  const removeLine = (i: number) => {
    setLines((prev) => prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i))
  }

  const reset = () => {
    setEntryDate(today)
    setDescription('')
    setReference('')
    setLines([emptyLine('debit'), emptyLine('credit')])
    setError(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!description.trim()) {
      setError('Description is required')
      return
    }
    if (!totals.balanced) {
      setError(`Debits (${fmtPesewas(totals.debit)}) must equal credits (${fmtPesewas(totals.credit)})`)
      return
    }
    for (const [i, l] of lines.entries()) {
      if (!l.account_id) {
        setError(`Line ${i + 1}: select an account`)
        return
      }
      if (toPesewas(l.amount) <= 0) {
        setError(`Line ${i + 1}: amount must be greater than 0`)
        return
      }
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/accounting/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_date:  entryDate,
          description: description.trim(),
          reference:   reference.trim() || undefined,
          lines: lines.map((l) => ({
            account_id:  l.account_id,
            side:        l.side,
            amount:      toPesewas(l.amount),
            description: l.description.trim() || undefined,
          })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`)
        setSubmitting(false)
        return
      }
      router.push('/accounting/journal')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Entry date</label>
            <input
              type="date"
              value={entryDate}
              max={today}
              onChange={(e) => setEntryDate(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-text-secondary mb-1">Reference (optional)</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. INV-001, RCT-2026-05"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="What is this entry for?"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="border-b border-border bg-surface-raised px-4 py-2.5 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Lines</h2>
          <span className="text-xs text-text-tertiary">{lines.length} line{lines.length === 1 ? '' : 's'}</span>
        </div>

        <div className="divide-y divide-border/40">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-start p-3">
              <select
                value={line.account_id}
                onChange={(e) => updateLine(i, { account_id: e.target.value })}
                required
                className="col-span-5 rounded-lg border border-border bg-surface px-2.5 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
              >
                <option value="">Select account…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
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
                type="number"
                step="0.01"
                min="0"
                value={line.amount}
                onChange={(e) => updateLine(i, { amount: e.target.value })}
                placeholder="0.00"
                required
                className="col-span-2 rounded-lg border border-border bg-surface px-2.5 py-2 text-right text-sm text-text-primary tabular-nums focus:border-brand focus:outline-none"
              />

              <input
                type="text"
                value={line.description}
                onChange={(e) => updateLine(i, { description: e.target.value })}
                placeholder="Memo (optional)"
                className="col-span-2 rounded-lg border border-border bg-surface px-2.5 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
              />

              <button
                type="button"
                onClick={() => removeLine(i)}
                disabled={lines.length <= 2}
                aria-label="Remove line"
                className="col-span-1 flex items-center justify-center rounded-lg border border-border bg-surface p-2 text-text-tertiary hover:bg-danger/10 hover:text-danger disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-border bg-surface-raised px-3 py-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => addLine('debit')}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
          >
            <Plus className="h-3 w-3" /> Add debit
          </button>
          <button
            type="button"
            onClick={() => addLine('credit')}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
          >
            <Plus className="h-3 w-3" /> Add credit
          </button>
        </div>

        <div className="border-t border-border bg-surface px-4 py-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-text-tertiary">Total debits</p>
            <p className="mt-1 font-semibold text-text-primary tabular-nums">GH₵ {fmtPesewas(totals.debit)}</p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary">Total credits</p>
            <p className="mt-1 font-semibold text-text-primary tabular-nums">GH₵ {fmtPesewas(totals.credit)}</p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary">Difference</p>
            <p className={`mt-1 font-semibold tabular-nums flex items-center gap-1 ${totals.balanced ? 'text-success' : 'text-danger'}`}>
              {totals.balanced
                ? <><CheckCircle2 className="h-3.5 w-3.5" /> Balanced</>
                : <><AlertTriangle className="h-3.5 w-3.5" /> GH₵ {fmtPesewas(Math.abs(totals.debit - totals.credit))}</>}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={submitting || !totals.balanced}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Post entry
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
        >
          Clear form
        </button>
      </div>
    </form>
  )
}
