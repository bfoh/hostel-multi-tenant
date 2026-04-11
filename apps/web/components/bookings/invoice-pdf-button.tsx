'use client'

import { useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'

export function InvoicePdfButton({ bookingId }: { bookingId: string }) {
  const [loading, setLoading] = useState(false)

  async function open() {
    setLoading(true)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/invoice`)
      if (!res.ok) throw new Error('Failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={open}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-raised transition-colors disabled:opacity-60"
    >
      {loading
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : <FileText className="h-3.5 w-3.5" />}
      Invoice PDF
    </button>
  )
}
