'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface Account {
  id:   string
  code: string
  name: string
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
}

const TYPE_OPTIONS: Account['type'][] = ['revenue', 'expense', 'asset', 'liability', 'equity']

const PERIOD_OPTIONS = [
  { id: 'mtd',        label: 'Month to date' },
  { id: 'qtd',        label: 'Quarter to date' },
  { id: 'ytd',        label: 'Year to date' },
  { id: 'last_month', label: 'Last month' },
  { id: 'last_year',  label: 'Last year' },
  { id: 'custom',     label: 'Custom range' },
] as const

export function NewReportForm({ accounts }: { accounts: Account[] }) {
  const router = useRouter()

  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [types, setTypes]             = useState<Set<Account['type']>>(new Set(['revenue', 'expense']))
  const [accountIds, setAccountIds]   = useState<Set<string>>(new Set())
  const [periodKind, setPeriodKind]   = useState<typeof PERIOD_OPTIONS[number]['id']>('mtd')
  const [customFrom, setCustomFrom]   = useState('')
  const [customTo, setCustomTo]       = useState('')
  const [grouping, setGrouping]       = useState<'by_account' | 'by_type'>('by_account')
  const [comparison, setComparison]   = useState<'none' | 'prior_period' | 'prior_year'>('none')
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const filteredAccounts = accounts.filter((a) => types.has(a.type))

  const toggleType = (t: Account['type']) => {
    setTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t); else next.add(t)
      return next
    })
  }

  const toggleAccount = (id: string) => {
    setAccountIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim())          { setError('Name required'); return }
    if (types.size === 0)      { setError('Pick at least one account type'); return }
    if (periodKind === 'custom' && (!customFrom || !customTo)) {
      setError('Custom range needs from + to dates'); return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/accounting/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        name.trim(),
          description: description.trim() || undefined,
          definition: {
            accountTypes: Array.from(types),
            accountIds:   accountIds.size > 0 ? Array.from(accountIds) : undefined,
            period: {
              kind: periodKind,
              ...(periodKind === 'custom' ? { from: customFrom, to: customTo } : {}),
            },
            grouping,
            comparison,
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? `Failed (${res.status})`); setSubmitting(false); return }
      router.push(`/accounting/reports/${data.id}`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Report name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Marketing spend YTD"
            required
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="optional"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Account types</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {TYPE_OPTIONS.map((t) => {
              const active = types.has(t)
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    active
                      ? 'bg-brand text-white'
                      : 'border border-border bg-surface text-text-secondary hover:bg-surface-raised hover:text-text-primary'
                  }`}
                >
                  {t}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
              Specific accounts {accountIds.size > 0 && `(${accountIds.size})`}
            </p>
            {accountIds.size > 0 && (
              <button
                type="button"
                onClick={() => setAccountIds(new Set())}
                className="text-[11px] text-text-tertiary hover:text-text-primary transition-colors"
              >
                Clear · use all of selected types
              </button>
            )}
          </div>
          <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface-raised p-2 space-y-1">
            {filteredAccounts.length === 0 ? (
              <p className="px-2 py-3 text-xs text-text-tertiary text-center">Pick at least one account type first.</p>
            ) : (
              filteredAccounts.map((a) => {
                const active = accountIds.has(a.id)
                return (
                  <label key={a.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-surface cursor-pointer">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleAccount(a.id)}
                      className="rounded border-border text-brand focus:ring-brand"
                    />
                    <span className="font-mono text-[10px] text-text-tertiary">{a.code}</span>
                    <span className="text-text-primary">{a.name}</span>
                    <span className="ml-auto text-[10px] capitalize text-text-tertiary">{a.type}</span>
                  </label>
                )
              })
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Period</p>
        <div className="flex flex-wrap gap-1">
          {PERIOD_OPTIONS.map((p) => {
            const active = periodKind === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodKind(p.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-brand text-white'
                    : 'border border-border bg-surface text-text-secondary hover:bg-surface-raised hover:text-text-primary'
                }`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
        {periodKind === 'custom' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Grouping</p>
        <div className="flex flex-wrap gap-1">
          {(['by_account', 'by_type'] as const).map((g) => {
            const active = grouping === g
            return (
              <button
                key={g}
                type="button"
                onClick={() => setGrouping(g)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-brand text-white'
                    : 'border border-border bg-surface text-text-secondary hover:bg-surface-raised hover:text-text-primary'
                }`}
              >
                {g === 'by_account' ? 'By account' : 'By type'}
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Comparison</p>
        <div className="flex flex-wrap gap-1">
          {([
            { id: 'none',         label: 'None' },
            { id: 'prior_period', label: 'Prior period (same length)' },
            { id: 'prior_year',   label: 'Prior year (same window)' },
          ] as const).map((c) => {
            const active = comparison === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setComparison(c.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-brand text-white'
                    : 'border border-border bg-surface text-text-secondary hover:bg-surface-raised hover:text-text-primary'
                }`}
              >
                {c.label}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-text-tertiary">
          Adds prior-amount + delta + delta % columns to the rendered report.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save &amp; run
        </button>
      </div>
    </form>
  )
}
