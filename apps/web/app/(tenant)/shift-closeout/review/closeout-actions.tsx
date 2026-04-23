'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'

export function CloseoutActions({ closeoutId }: { closeoutId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function approve() {
    setBusy(true)
    try {
      await fetch('/api/shift-closeout/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: closeoutId, status: 'approved' }),
      })
      router.refresh()
    } catch {
      // silently handle
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={approve}
      disabled={busy}
      className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-1 text-xs font-medium text-success hover:bg-success/20 disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
      Approve
    </button>
  )
}
