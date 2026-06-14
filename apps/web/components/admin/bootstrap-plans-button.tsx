'use client'

import { useState } from 'react'
import { Loader2, Zap, RefreshCcw } from 'lucide-react'

interface Result {
  name: string
  interval: string
  env: string
  planCode: string
  amount: number
  created: boolean
}

export function BootstrapPlansButton() {
  const [busy, setBusy]   = useState<'idempotent' | 'force' | null>(null)
  const [results, setR]   = useState<Result[] | null>(null)
  const [forced, setForced] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(force: boolean) {
    const confirmMsg = force
      ? 'Force-recreate all Paystack plans? Old plan codes become orphaned — you must paste the NEW codes into env vars and redeploy for subscriptions to use the new amounts.'
      : 'Create missing Paystack subscription plans on the platform merchant?'
    if (!confirm(confirmMsg)) return

    setBusy(force ? 'force' : 'idempotent')
    setError(null); setR(null); setForced(false)
    try {
      const res = await fetch('/api/admin/paystack/bootstrap-plans', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ force }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Bootstrap failed')
      setR(json.results as Result[])
      setForced(!!json.force)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => run(false)}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-50"
        >
          {busy === 'idempotent' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Bootstrap Paystack plans
        </button>
        <button
          onClick={() => run(true)}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
          title="Recreate plans from scratch (use after price changes)"
        >
          {busy === 'force' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Force-recreate
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {results && (
        <div className="rounded-lg border border-white/10 bg-black/40 p-4 text-xs space-y-2">
          <p className="text-white/70">
            {forced
              ? 'Recreated. Paste the NEW env vars below and redeploy. Old codes are now orphaned.'
              : 'Paste these into env vars (PAYSTACK_PLAN_<TIER>_<INTERVAL>), then redeploy:'}
          </p>
          {results.map((r) => (
            <div key={r.env} className="flex items-baseline gap-3 font-mono">
              <span className="text-white/80">{r.env}</span>
              <span className="text-white/40">=</span>
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
