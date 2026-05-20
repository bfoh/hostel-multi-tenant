'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Unlock, Loader2 } from 'lucide-react'

export function ClosePeriodActions({
  year, month, status,
}: {
  year: number
  month: number
  status: 'open' | 'closed'
}) {
  const router = useRouter()
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState<string | null>(null)

  const label = new Date(year, month - 1, 1).toLocaleDateString('en-GH', { month: 'long', year: 'numeric' })

  async function action(kind: 'close' | 'reopen') {
    if (kind === 'close' && !confirm(`Close ${label}? This posts the closing entry to retained earnings and locks the period.`)) return
    if (kind === 'reopen' && !confirm(`Reopen ${label}? This deletes the closing entry and reopens the period for edits.`)) return

    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/accounting/periods/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month }),
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
      {status === 'open' ? (
        <button
          type="button"
          onClick={() => action('close')}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lock className="h-3 w-3" />}
          Close period
        </button>
      ) : (
        <button
          type="button"
          onClick={() => action('reopen')}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary disabled:opacity-50 transition-colors"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlock className="h-3 w-3" />}
          Reopen
        </button>
      )}
      {error && <p className="text-[10px] text-danger">{error}</p>}
    </div>
  )
}
