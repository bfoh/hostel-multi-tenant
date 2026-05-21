'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'

export function RecurringGenerateButton({ dueCount }: { dueCount: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (dueCount === 0) { setMsg('Nothing due — schedule a template first.'); return }
    if (!confirm(`Generate ${dueCount} due entr${dueCount === 1 ? 'y' : 'ies'} now?`)) return
    setBusy(true); setError(null); setMsg(null)
    try {
      const res = await fetch('/api/accounting/recurring/generate', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? `Failed (${res.status})`); setBusy(false); return }
      setMsg(`${data.billsGenerated} bill${data.billsGenerated === 1 ? '' : 's'}, ${data.journalsGenerated} journal entr${data.journalsGenerated === 1 ? 'y' : 'ies'} generated.${data.errors?.length ? ` ${data.errors.length} error(s).` : ''}`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Generate due entries
        {dueCount > 0 && (
          <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0 text-[10px] font-semibold">{dueCount}</span>
        )}
      </button>
      {msg   && <p className="text-[11px] text-success max-w-xs text-right">{msg}</p>}
      {error && <p className="text-[11px] text-danger max-w-xs text-right">{error}</p>}
    </div>
  )
}
