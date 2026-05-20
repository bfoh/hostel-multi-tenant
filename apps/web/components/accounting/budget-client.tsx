'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'

import { formatGHS } from '@/lib/utils'
import type { BudgetVarianceRow } from '@/lib/data/budgets'

const MONTHS = [
  'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec',
] as const

export function BudgetMonthPicker({ year, month }: { year: number; month: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()

  const update = (y: number, m: number) => {
    const next = new URLSearchParams(search.toString())
    next.set('year',  String(y))
    next.set('month', String(m))
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={month}
        onChange={(e) => update(year, parseInt(e.target.value, 10))}
        className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary focus:border-brand focus:outline-none"
      >
        {MONTHS.map((m, i) => (
          <option key={i} value={i + 1}>{m}</option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => update(parseInt(e.target.value, 10), month)}
        className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary focus:border-brand focus:outline-none"
      >
        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  )
}

export function BudgetVarianceTable({
  year,
  month,
  revenue,
  expenses,
}: {
  year:     number
  month:    number
  revenue:  BudgetVarianceRow[]
  expenses: BudgetVarianceRow[]
}) {
  return (
    <div className="space-y-6">
      <Section title="Revenue accounts" rows={revenue} year={year} month={month} />
      <Section title="Expense accounts" rows={expenses} year={year} month={month} />
    </div>
  )
}

function Section({
  title, rows, year, month,
}: {
  title: string
  rows:  BudgetVarianceRow[]
  year:  number
  month: number
}) {
  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="border-b border-border bg-surface-raised px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-text-tertiary text-center">No accounts in this section.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-surface">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary w-20">Code</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary">Account</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-40">Budget (GHS)</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-36">Actual</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-32">Variance</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-24">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.map((r) => (
                <BudgetRow key={r.account_id} row={r} year={year} month={month} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function BudgetRow({
  row, year, month,
}: {
  row:   BudgetVarianceRow
  year:  number
  month: number
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState((row.budget / 100).toFixed(2))
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function save() {
    setError(null)
    const num = parseFloat(draft)
    if (!Number.isFinite(num) || num < 0) {
      setError('Invalid amount')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/accounting/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: row.account_id,
          year,
          month,
          amount: Math.round(num * 100),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? `Failed (${res.status})`); setSaving(false); return }
      setEditing(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const varTone = row.variance === 0
    ? 'text-text-tertiary'
    : row.isFavorable
    ? 'text-success'
    : 'text-danger'

  return (
    <tr className="hover:bg-surface-raised/50 transition-colors">
      <td className="px-4 py-2.5 font-mono text-xs text-text-tertiary">{row.code}</td>
      <td className="px-4 py-2.5 text-sm text-text-primary">{row.name}</td>
      <td className="px-4 py-2.5 text-right">
        {editing ? (
          <div className="flex items-center justify-end gap-1">
            <input
              type="number"
              step="0.01"
              min="0"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={saving}
              autoFocus
              className="w-28 rounded-lg border border-brand bg-surface px-2 py-1 text-right text-sm tabular-nums focus:outline-none"
            />
            <button
              type="button"
              onClick={save}
              disabled={saving}
              aria-label="Save"
              className="rounded-lg bg-brand p-1.5 text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md px-2 py-1 text-sm tabular-nums text-text-primary hover:bg-surface-raised transition-colors"
          >
            {row.budget > 0 ? formatGHS(row.budget) : <span className="text-text-tertiary italic">— set —</span>}
          </button>
        )}
        {error && <p className="mt-1 text-[10px] text-danger">{error}</p>}
      </td>
      <td className="px-4 py-2.5 text-right text-sm tabular-nums currency-amount text-text-primary">
        {row.actual > 0 ? formatGHS(row.actual) : '—'}
      </td>
      <td className={`px-4 py-2.5 text-right text-sm font-medium tabular-nums currency-amount ${varTone}`}>
        {row.variance === 0 ? '—' : `${row.variance >= 0 ? '+' : '−'}${formatGHS(Math.abs(row.variance))}`}
      </td>
      <td className={`px-4 py-2.5 text-right text-[11px] tabular-nums ${varTone}`}>
        {row.variancePct === null ? '—' : `${row.variancePct >= 0 ? '+' : ''}${row.variancePct.toFixed(1)}%`}
      </td>
    </tr>
  )
}
