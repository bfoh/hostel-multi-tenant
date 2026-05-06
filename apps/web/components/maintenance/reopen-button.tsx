'use client'

import { useState } from 'react'
import { RotateCcw, Loader2 } from 'lucide-react'

export function ReopenButton({ requestId, onReopened }: { requestId: string; onReopened: () => void }) {
  const [busy, setBusy] = useState(false)
  const click = async () => {
    setBusy(true)
    const res = await fetch(`/api/maintenance/${requestId}/reopen`, { method: 'POST' })
    setBusy(false)
    if (res.ok) onReopened()
  }
  return (
    <button type="button" onClick={click} disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
      Reopen
    </button>
  )
}
