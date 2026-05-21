'use client'

import { useState } from 'react'
import { Bell, Loader2, Check } from 'lucide-react'

import { formatGHS } from '@/lib/utils'

export function SendReminderButton({
  occupantId,
  bookingId,
  balance,
  compact,
}: {
  occupantId?: string
  bookingId?:  string
  balance:     number
  compact?:    boolean
}) {
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    if (!confirm(`Send SMS reminder for ${formatGHS(balance)} outstanding?`)) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/accounting/ar/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(bookingId  ? { booking_id:  bookingId  } : {}),
          ...(occupantId ? { occupant_id: occupantId } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? `Failed (${res.status})`); return }
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <span className={`inline-flex items-center gap-1 ${compact ? 'text-[10px]' : 'text-xs'} font-medium text-success`}>
        <Check className={`${compact ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />
        Reminder sent
      </span>
    )
  }

  return (
    <div className={`flex ${compact ? 'flex-row items-center' : 'flex-col items-end'} gap-1`}>
      <button
        type="button"
        onClick={send}
        disabled={busy}
        className={`inline-flex items-center gap-1 rounded-lg border border-border bg-surface ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1.5 text-xs'} font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary disabled:opacity-50 transition-colors`}
      >
        {busy ? <Loader2 className={compact ? 'h-2.5 w-2.5 animate-spin' : 'h-3 w-3 animate-spin'} /> : <Bell className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />}
        Remind
      </button>
      {error && <p className={`${compact ? 'text-[9px]' : 'text-[10px]'} text-danger`}>{error}</p>}
    </div>
  )
}
