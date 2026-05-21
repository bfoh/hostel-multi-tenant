'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RotateCcw, X } from 'lucide-react'

export function VoidEntryButton({ entryId, isVoided }: { entryId: string; isVoided: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'void' | 'reverse'>('void')
  const [reason, setReason] = useState('')
  const [reverseDate, setReverseDate] = useState(new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isVoided) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-semibold text-danger">
        <X className="h-2.5 w-2.5" />
        Voided
      </span>
    )
  }

  async function submit() {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/accounting/journal/${entryId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reverse: mode === 'reverse',
          reason:  reason.trim() || undefined,
          reverse_date: mode === 'reverse' ? reverseDate : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? `Failed (${res.status})`); setBusy(false); return }
      setOpen(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] text-text-tertiary hover:text-danger transition-colors"
      >
        Void / Reverse…
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-3 space-y-2 w-full max-w-md">
      <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1 text-[11px]">
        <button
          type="button"
          onClick={() => setMode('void')}
          className={`flex-1 rounded-md px-2 py-1 transition-colors ${mode === 'void' ? 'bg-brand text-white' : 'text-text-secondary hover:bg-surface-raised'}`}
        >
          <X className="inline h-3 w-3 mr-1" /> Void (same-day mistake)
        </button>
        <button
          type="button"
          onClick={() => setMode('reverse')}
          className={`flex-1 rounded-md px-2 py-1 transition-colors ${mode === 'reverse' ? 'bg-brand text-white' : 'text-text-secondary hover:bg-surface-raised'}`}
        >
          <RotateCcw className="inline h-3 w-3 mr-1" /> Reverse (post correction)
        </button>
      </div>

      <p className="text-[10px] text-text-tertiary">
        {mode === 'void'
          ? 'Marks the entry as voided in place. Use only for clear mistakes captured the same day.'
          : 'Leaves the original alone and posts a new entry with debits and credits swapped on a chosen date — preferred when the entry has already been included in a report or closed period.'}
      </p>

      {mode === 'reverse' && (
        <div>
          <label className="block text-[10px] text-text-tertiary mb-1">Reversal date</label>
          <input
            type="date"
            value={reverseDate}
            onChange={(e) => setReverseDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-xs focus:border-brand focus:outline-none"
          />
        </div>
      )}

      <div>
        <label className="block text-[10px] text-text-tertiary mb-1">{mode === 'void' ? 'Void reason' : 'Reason for reversal'}</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-xs focus:border-brand focus:outline-none"
        />
      </div>

      {error && <p className="text-[10px] text-danger">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {busy && <Loader2 className="h-3 w-3 animate-spin" />}
          Confirm
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null) }}
          className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
