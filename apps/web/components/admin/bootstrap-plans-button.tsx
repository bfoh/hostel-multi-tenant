'use client'

import { useState } from 'react'
import { Loader2, Zap } from 'lucide-react'

interface Result {
  name: string
  planCode: string
  amount: number
  created: boolean
}

export function BootstrapPlansButton() {
  const [busy, setBusy]     = useState(false)
  const [results, setR]     = useState<Result[] | null>(null)
  const [error, setError]   = useState<string | null>(null)

  async function run() {
    if (!confirm('Create missing Paystack subscription plans on the platform merchant?')) return
    setBusy(true); setError(null); setR(null)
    try {
      const res = await fetch('/api/admin/paystack/bootstrap-plans', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Bootstrap failed')
      setR(json.results as Result[])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
        Bootstrap Paystack plans
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {results && (
        <div className="rounded-lg border border-white/10 bg-black/40 p-4 text-xs space-y-2">
          <p className="text-white/70">Paste these into env vars, then redeploy:</p>
          {results.map((r) => (
            <div key={r.name} className="flex items-baseline gap-3 font-mono">
              <span className="w-20 text-white/40 uppercase">{r.name}</span>
              <span className={r.created ? 'text-green-400' : 'text-white/60'}>
                {r.planCode}
              </span>
              <span className="text-white/40">GHS {(r.amount / 100).toLocaleString()}</span>
              {r.created && <span className="text-green-400/80 text-[10px]">NEW</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
