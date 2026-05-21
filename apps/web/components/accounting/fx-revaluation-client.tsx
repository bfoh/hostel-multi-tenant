'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Loader2 } from 'lucide-react'

import { formatGHS } from '@/lib/utils'

export function FxRevalRunButton({
  asOf,
  alreadyPosted,
  missingRates,
  hasRows,
  netAdjustment,
}: {
  asOf:           string
  alreadyPosted:  boolean
  missingRates:   string[]
  hasRows:        boolean
  netAdjustment:  number
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const disabled = alreadyPosted || missingRates.length > 0 || !hasRows || netAdjustment === 0

  async function run() {
    const msg = `Post FX revaluation for ${asOf}? Net adjustment ${netAdjustment >= 0 ? '+' : '−'}${formatGHS(Math.abs(netAdjustment))}. This creates a journal entry that cannot be edited.`
    if (!confirm(msg)) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/accounting/fx/revalue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ as_of_date: asOf }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? `Failed (${res.status})`); setBusy(false); return }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={busy || disabled}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        Post revaluation
      </button>
      {error && <p className="text-[11px] text-danger max-w-xs text-right">{error}</p>}
    </div>
  )
}
