'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Loader2 } from 'lucide-react'

interface Props {
  bookingId: string
  bookingRef: string
}

type State = 'idle' | 'confirming' | 'rejecting' | 'reject-prompt'

export function SelfCheckinConfirmPanel({ bookingId, bookingRef }: Props) {
  const router = useRouter()
  const [state, setState] = useState<State>('idle')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function send(action: 'confirm' | 'reject', reasonText?: string) {
    setError(null)
    setState(action === 'confirm' ? 'confirming' : 'rejecting')
    try {
      const res = await fetch(`/api/bookings/${bookingId}/confirm-self-checkin`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, reason: reasonText ?? undefined }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Failed')
        setState('idle')
        return
      }
      router.refresh()
    } catch {
      setError('Network error')
      setState('idle')
    }
  }

  if (state === 'reject-prompt') {
    return (
      <div className="mt-4 space-y-2 rounded-lg border border-border bg-surface-sunken p-3">
        <p className="text-xs font-medium text-text-secondary">
          Reason for rejecting {bookingRef}
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="ID mismatch, room unavailable, etc."
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand/25"
        />
        <div className="flex gap-2">
          <button
            onClick={() => send('reject', reason.trim() || undefined)}
            disabled={state !== 'reject-prompt' as any}
            className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Confirm reject
          </button>
          <button
            onClick={() => { setState('idle'); setReason('') }}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-raised transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4 flex items-center gap-2">
      <button
        onClick={() => send('confirm')}
        disabled={state !== 'idle'}
        className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {state === 'confirming'
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Check className="h-4 w-4" />}
        Confirm booking
      </button>
      <button
        onClick={() => setState('reject-prompt')}
        disabled={state !== 'idle'}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text-secondary hover:text-danger hover:bg-danger/5 hover:border-danger/40 transition-colors disabled:opacity-50"
      >
        <X className="h-4 w-4" />
        Reject
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )
}
