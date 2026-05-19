'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Loader2 } from 'lucide-react'

export function RefreshButton({ date }: { date: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState<string | null>(null)

  async function refresh() {
    setBusy(true); setErr(null)
    try {
      const res = await fetch(`/api/reports/daily/${date}`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErr(typeof data.error === 'string' ? data.error : 'Refresh failed')
        return
      }
      router.refresh()
    } catch {
      setErr('Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {err && <span className="text-[11px] text-danger">{err}</span>}
      <button
        onClick={refresh}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-md border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-sunken transition-colors disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        {busy ? 'Refreshing…' : 'Refresh now'}
      </button>
    </div>
  )
}
