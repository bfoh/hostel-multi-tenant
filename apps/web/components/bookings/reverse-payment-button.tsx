'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Undo2 } from 'lucide-react'
import { formatGHS } from '@/lib/utils'

export function ReversePaymentButton({
  bookingId, paymentId, amount,
}: {
  bookingId: string
  paymentId: string
  amount: number // pesewas
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reverse() {
    if (!confirm(`Reverse this ${formatGHS(amount)} payment? This reduces the booking's recorded paid amount and cannot be undone.`)) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/payments/${paymentId}`, { method: 'PATCH' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(typeof d.error === 'string' ? d.error : 'Failed to reverse payment')
        return
      }
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="text-right">
      <button
        onClick={reverse}
        disabled={loading}
        title="Reverse this payment"
        className="inline-flex items-center gap-1 text-[11px] font-medium text-text-tertiary hover:text-danger transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
        Reverse
      </button>
      {error && <p className="mt-0.5 text-[10px] text-danger">{error}</p>}
    </div>
  )
}
