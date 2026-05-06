'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'

export function MaintenanceCloseButton({
  requestId, onClosed,
}: {
  requestId: string
  onClosed:  () => void
}) {
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const close = async () => {
    setBusy(true)
    const res = await fetch(`/api/occupant/maintenance/${requestId}/close`, { method: 'POST' })
    setBusy(false)
    setConfirmOpen(false)
    if (res.ok) onClosed()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        <CheckCircle2 className="h-3.5 w-3.5" /> Mark as resolved
      </button>
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-4"
          onClick={() => !busy && setConfirmOpen(false)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900">Close this request?</h3>
            <p className="mt-1 text-sm text-slate-500">Hostel staff can reopen it if you change your mind.</p>
            <div className="mt-4 flex gap-2">
              <button type="button" disabled={busy} onClick={() => setConfirmOpen(false)} className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-700">Cancel</button>
              <button type="button" disabled={busy} onClick={close} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-sm font-bold text-white">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Close request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
