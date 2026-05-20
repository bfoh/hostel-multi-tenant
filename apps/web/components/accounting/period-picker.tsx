'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useMemo } from 'react'

function fmt(d: Date) {
  return d.toISOString().slice(0, 10)
}

function presets(): { id: string; label: string; from: string; to: string }[] {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()

  const startOfMonth = new Date(y, m, 1)
  const endOfToday   = now

  const startOfLastMonth = new Date(y, m - 1, 1)
  const endOfLastMonth   = new Date(y, m, 0)

  const startOfQuarter = new Date(y, Math.floor(m / 3) * 3, 1)
  const startOfYear    = new Date(y, 0, 1)
  const startOfLastYear = new Date(y - 1, 0, 1)
  const endOfLastYear   = new Date(y - 1, 11, 31)

  return [
    { id: 'mtd',       label: 'MTD',        from: fmt(startOfMonth),     to: fmt(endOfToday) },
    { id: 'last-month',label: 'Last Month', from: fmt(startOfLastMonth), to: fmt(endOfLastMonth) },
    { id: 'qtd',       label: 'QTD',        from: fmt(startOfQuarter),   to: fmt(endOfToday) },
    { id: 'ytd',       label: 'YTD',        from: fmt(startOfYear),      to: fmt(endOfToday) },
    { id: 'last-year', label: 'Last Year',  from: fmt(startOfLastYear),  to: fmt(endOfLastYear) },
  ]
}

interface Props {
  from: string
  to: string
  /** Use single-date mode (Balance Sheet "as of"). Hides "from" input and emits ?asOf= only. */
  mode?: 'range' | 'asOf'
  asOf?: string
}

export function PeriodPicker({ from, to, mode = 'range', asOf }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()

  const items = useMemo(() => presets(), [])

  const apply = (params: Record<string, string>) => {
    const next = new URLSearchParams(search.toString())
    Object.entries(params).forEach(([k, v]) => next.set(k, v))
    router.push(`${pathname}?${next.toString()}`)
  }

  if (mode === 'asOf') {
    const value = asOf ?? fmt(new Date())
    return (
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-text-secondary">As of</label>
        <input
          type="date"
          value={value}
          max={fmt(new Date())}
          onChange={(e) => apply({ asOf: e.target.value })}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-brand focus:outline-none"
        />
      </div>
    )
  }

  const activePreset = items.find((p) => p.from === from && p.to === to)?.id

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
        {items.map((p) => {
          const active = activePreset === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => apply({ from: p.from, to: p.to })}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={from}
          onChange={(e) => apply({ from: e.target.value, to })}
          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary focus:border-brand focus:outline-none"
        />
        <span className="text-xs text-text-tertiary">to</span>
        <input
          type="date"
          value={to}
          max={fmt(new Date())}
          onChange={(e) => apply({ from, to: e.target.value })}
          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary focus:border-brand focus:outline-none"
        />
      </div>
    </div>
  )
}
