'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2 } from 'lucide-react'

export function SettleSaleButton({ saleId, amountLabel }: { saleId: string; amountLabel: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function settle() {
    if (!confirm(`Confirm cash received for ${amountLabel}? This posts the sale to the ledger.`)) return
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/revenue-points/sales/${saleId}/settle`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? `Failed (${res.status})`); setBusy(false); return }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={settle}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-[11px] font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-50 transition-colors"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
        Mark paid
      </button>
      {error && <span className="text-[10px] text-danger">{error}</span>}
    </div>
  )
}
