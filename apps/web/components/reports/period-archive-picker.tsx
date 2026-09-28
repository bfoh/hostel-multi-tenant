'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar, ChevronDown } from 'lucide-react'
import type { ArchiveMode, ArchivePeriod } from '@/lib/reports/period-archive'

const MODE_TABS: Array<{ value: ArchiveMode; label: string }> = [
  { value: 'week',  label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'year',  label: 'Yearly' },
]

/**
 * Weekly/Monthly/Yearly tabs + a dropdown of every period in that mode's
 * fixed lookback (see lib/reports/period-archive.ts) — ported from AMP
 * Lodge's "Booking Breakdown Archive" picker so any past week/month/year's
 * numbers are one click away instead of only "this" vs. "last."
 * Server-rendered pages compute `periods` and pass them in; this component
 * only owns the open/closed state of the dropdown panel, navigating via
 * plain query-param links so the page itself stays a Server Component.
 */
export function PeriodArchivePicker({
  basePath,
  extraParams = {},
  mode,
  periods,
  selectedIdx,
}: {
  basePath: string
  extraParams?: Record<string, string>
  mode: ArchiveMode
  periods: ArchivePeriod[]
  selectedIdx: number
}) {
  const [open, setOpen] = useState(false)
  const current = periods[selectedIdx] ?? periods[0]

  function hrefFor(nextMode: ArchiveMode, idx: number) {
    const params = new URLSearchParams(extraParams)
    params.set('archiveMode', nextMode)
    params.set('archiveIdx', String(idx))
    return `${basePath}?${params.toString()}`
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-lg border border-border bg-surface-sunken p-1">
        {MODE_TABS.map((t) => (
          <Link
            key={t.value}
            href={hrefFor(t.value, 0)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === t.value ? 'bg-brand text-white' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-raised"
        >
          <Calendar className="h-3.5 w-3.5 text-text-tertiary" />
          {current?.label ?? '—'}
          <ChevronDown className="h-3.5 w-3.5 text-text-tertiary" />
        </button>

        {open && (
          <>
            {/* Click-outside catcher */}
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 z-20 mt-1 max-h-72 w-48 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
              {periods.map((p) => (
                <Link
                  key={p.idx}
                  href={hrefFor(mode, p.idx)}
                  onClick={() => setOpen(false)}
                  className={`block px-3 py-2 text-xs transition-colors ${
                    p.idx === selectedIdx
                      ? 'bg-brand-subtle font-semibold text-brand'
                      : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
                  }`}
                >
                  {p.label}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
