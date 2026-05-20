'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Play, AlertTriangle } from 'lucide-react'

import { formatGHS } from '@/lib/utils'

interface Props {
  nextPeriod:        { year: number; month: number }
  thisMonthEstimate: number
  configuredCount:   number
  unconfiguredCount: number
}

export function DepreciationActions({ nextPeriod, thisMonthEstimate, configuredCount, unconfiguredCount }: Props) {
  const router = useRouter()
  const [year, setYear]   = useState(nextPeriod.year)
  const [month, setMonth] = useState(nextPeriod.month)
  const [running, setRunning] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const periodLabel = new Date(year, month - 1, 1)
    .toLocaleDateString('en-GH', { month: 'long', year: 'numeric' })

  async function run() {
    if (!confirm(`Post depreciation for ${periodLabel}? This creates a journal entry that cannot be edited.`)) return
    setRunning(true); setError(null); setSuccess(null)
    try {
      const res = await fetch('/api/accounting/depreciation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? `Failed (${res.status})`); setRunning(false); return }
      setSuccess(`Posted ${formatGHS(data.total_amount)} across ${data.asset_count} asset${data.asset_count === 1 ? '' : 's'}`)
      setRunning(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
      setRunning(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Post monthly depreciation</h2>
          <p className="mt-1 text-xs text-text-tertiary">
            Default period is the next month not yet posted. Estimate based on current configuration: <strong className="text-text-primary">{formatGHS(thisMonthEstimate)}</strong> across {configuredCount} asset{configuredCount === 1 ? '' : 's'}.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[10px] font-medium text-text-tertiary mb-1 uppercase tracking-widest">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
              className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{new Date(2025, m - 1).toLocaleString('en-GH', { month: 'short' })}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-text-tertiary mb-1 uppercase tracking-widest">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
            >
              {Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - 1 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={run}
            disabled={running || thisMonthEstimate === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run depreciation
          </button>
        </div>
      </div>

      {unconfiguredCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300 inline-flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5" />
          {unconfiguredCount} asset{unconfiguredCount === 1 ? '' : 's'} have a purchase price but no useful life set — configure below to include them.
        </div>
      )}

      {error && <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">{error}</p>}
      {success && <p className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-xs text-success">{success}</p>}
    </div>
  )
}
