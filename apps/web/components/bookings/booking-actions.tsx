'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const TRANSITIONS: Record<string, { label: string; next: string; style: string }[]> = {
  pending_payment: [
    { label: 'Confirm Booking',  next: 'confirmed',   style: 'bg-brand text-brand-fg hover:bg-brand-hover' },
    { label: 'Mark No Show',     next: 'no_show',      style: 'border border-danger text-danger hover:bg-danger-subtle' },
    { label: 'Cancel',           next: 'cancelled',    style: 'border border-border text-text-secondary hover:bg-surface-raised' },
  ],
  confirmed: [
    { label: 'Check In',         next: 'checked_in',   style: 'bg-success text-success-fg hover:opacity-90' },
    { label: 'Cancel',           next: 'cancelled',    style: 'border border-border text-text-secondary hover:bg-surface-raised' },
  ],
  checked_in: [
    { label: 'Check Out',        next: 'checked_out',  style: 'bg-brand text-brand-fg hover:bg-brand-hover' },
  ],
}

interface Props {
  bookingId: string
  status: string
}

export function BookingActions({ bookingId, status }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const actions = TRANSITIONS[status] ?? []

  if (actions.length === 0) return null

  async function transition(nextStatus: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (res.ok) router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-2 flex-wrap justify-end">
      {actions.map((action) => (
        <button
          key={action.next}
          disabled={loading}
          onClick={() => transition(action.next)}
          className={`rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${action.style}`}
        >
          {loading ? '…' : action.label}
        </button>
      ))}
    </div>
  )
}
