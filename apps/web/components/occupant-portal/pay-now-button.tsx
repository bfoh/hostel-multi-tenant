'use client'

import { useState } from 'react'
import { Loader2, CreditCard, ArrowRight } from 'lucide-react'

interface Props {
  bookingId: string
  balance:   number
  color:     string
}

function ghs(pesewas: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(pesewas / 100)
}

export function PayNowButton({ bookingId, balance, color }: Props) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function pay() {
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/occupant/pay', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ booking_id: bookingId, amount: balance }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to initiate payment')
      window.location.href = data.authorization_url
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-200 text-center">{error}</p>}
      <button
        onClick={pay}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ color }}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <CreditCard className="h-4 w-4" />
            Pay {ghs(balance)} now
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </div>
  )
}
