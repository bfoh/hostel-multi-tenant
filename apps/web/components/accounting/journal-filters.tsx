'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'

interface Props {
  accounts:      { id: string; code: string; name: string }[]
  sources:       { id: string; label: string }[]
  activeSource?: string
  activeFrom?:   string
  activeTo?:     string
  activeAccount?:string
}

export function JournalFilters({ accounts, sources, activeSource, activeFrom, activeTo, activeAccount }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(search.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.push(`${pathname}?${next.toString()}`)
  }

  const reset = () => router.push(pathname)
  const hasFilters = Boolean(activeSource || activeFrom || activeTo || activeAccount)

  return (
    <div className="rounded-xl border border-border bg-surface p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={activeSource ?? ''}
          onChange={(e) => update('source', e.target.value || null)}
          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary focus:border-brand focus:outline-none"
        >
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>

        <select
          value={activeAccount ?? ''}
          onChange={(e) => update('account', e.target.value || null)}
          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary focus:border-brand focus:outline-none max-w-xs"
        >
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <input
            type="date"
            value={activeFrom ?? ''}
            onChange={(e) => update('from', e.target.value || null)}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-text-primary focus:border-brand focus:outline-none"
          />
          <span className="text-xs text-text-tertiary">to</span>
          <input
            type="date"
            value={activeTo ?? ''}
            onChange={(e) => update('to', e.target.value || null)}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-text-primary focus:border-brand focus:outline-none"
          />
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
