'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2, X } from 'lucide-react'

const TRANSITIONS: Record<string, { label: string; next: string; style: string }[]> = {
  pending_payment: [
    {
      label: 'Confirm Booking',
      next: 'confirmed',
      style: 'bg-brand text-brand-fg hover:bg-brand-hover',
    },
    {
      label: 'Mark No Show',
      next: 'no_show',
      style: 'border border-danger text-danger hover:bg-danger-subtle',
    },
    {
      label: 'Cancel',
      next: 'cancelled',
      style: 'border border-border text-text-secondary hover:bg-surface-raised',
    },
  ],
  confirmed: [
    { label: 'Check In', next: 'checked_in', style: 'bg-success text-success-fg hover:opacity-90' },
    {
      label: 'Cancel',
      next: 'cancelled',
      style: 'border border-border text-text-secondary hover:bg-surface-raised',
    },
  ],
  checked_in: [
    {
      label: 'Check Out',
      next: 'checked_out',
      style: 'bg-brand text-brand-fg hover:bg-brand-hover',
    },
  ],
}

interface Props {
  bookingId: string
  status: string
  paymentStatus: string
  paidAmount: number
  canCancel: boolean
}

export function BookingActions({ bookingId, status, paymentStatus, paidAmount, canCancel }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const actions = (TRANSITIONS[status] ?? []).filter(
    (action) => action.next !== 'cancelled' || canCancel
  )

  if (actions.length === 0) return null

  async function transition(nextStatus: string) {
    if (nextStatus === 'cancelled') {
      setError(null)
      setShowCancel(true)
      return
    }

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

  async function cancelBooking() {
    const cleanReason = reason.trim()
    if (cleanReason.length < 3) {
      setError('Please provide a cancellation reason.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cleanReason, expectedStatus: status }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error ?? 'Cancellation failed')
        return
      }
      setShowCancel(false)
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const formattedPaid = new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
  }).format(paidAmount / 100)

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
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

      {showCancel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-booking-title"
            className="border-border bg-surface w-full max-w-md rounded-xl border p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="cancel-booking-title" className="text-text-primary text-lg font-semibold">
                  Cancel booking
                </h2>
                <p className="text-text-secondary mt-1 text-sm">
                  This releases the booking’s room allocation and cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCancel(false)}
                disabled={loading}
                aria-label="Close cancellation dialog"
                className="text-text-tertiary hover:bg-surface-raised hover:text-text-primary rounded-md p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {paidAmount > 0 && (
              <div className="border-warning/30 bg-warning-subtle text-warning-fg mt-4 flex gap-3 rounded-lg border p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  This booking has {formattedPaid} recorded as {paymentStatus}. Cancelling does not
                  automatically refund it.
                </p>
              </div>
            )}

            <label
              htmlFor="cancellation-reason"
              className="text-text-primary mt-4 block text-sm font-medium"
            >
              Cancellation reason
            </label>
            <textarea
              id="cancellation-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              rows={4}
              autoFocus
              placeholder="Explain why this booking is being cancelled…"
              className="border-border bg-surface text-text-primary focus:border-brand focus:ring-brand/20 mt-1.5 w-full resize-none rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
            />
            <div className="text-text-tertiary mt-1 flex justify-between text-xs">
              <span>{error && <span className="text-danger">{error}</span>}</span>
              <span>{reason.length}/500</span>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCancel(false)}
                disabled={loading}
                className="border-border text-text-secondary hover:bg-surface-raised rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                Keep booking
              </button>
              <button
                type="button"
                onClick={cancelBooking}
                disabled={loading || reason.trim().length < 3}
                className="bg-danger inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
