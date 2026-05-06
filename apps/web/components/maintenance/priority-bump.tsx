'use client'

import { useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
type P = typeof PRIORITIES[number]

const COLOR: Record<P, string> = {
  low:    'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high:   'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
}

export function PriorityBump({
  requestId, current, onChange,
}: {
  requestId: string
  current:   P
  onChange:  (next: P) => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const set = async (next: P) => {
    if (next === current) { setOpen(false); return }
    setBusy(true)
    const res = await fetch(`/api/maintenance/${requestId}/priority`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: next }),
    })
    setBusy(false)
    setOpen(false)
    if (res.ok) onChange(next)
  }

  return (
    <div className="relative inline-block">
      <button type="button" onClick={() => setOpen(!open)} disabled={busy}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ${COLOR[current]}`}>
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : current}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-32 rounded-lg border border-slate-200 bg-white shadow-lg">
          {PRIORITIES.map(p => (
            <button key={p} type="button" onClick={() => set(p)}
              className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 ${p === current ? 'font-bold' : ''}`}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
