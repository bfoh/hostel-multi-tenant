'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Loader2, KeyRound } from 'lucide-react'

interface Sale {
  id:               string
  total_amount:     number
  description:      string
  sold_at:          string
  status:           string
  customer_name:    string | null
  weight_kg:        number | null
  duration_minutes: number | null
  entry_token:      string
  payment_method:   string
}

function ghs(p: number) {
  return `GH₵ ${(p / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

export function VerifyCodeWidget({
  pointId,
  pointType,
}: {
  pointId:   string
  pointType: string
}) {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<
    | { valid: boolean; reason: string | null; sale: Sale | null }
    | null
  >(null)

  async function verify() {
    if (token.trim().length < 4) return
    setLoading(true); setResult(null)
    try {
      const res = await fetch(`/api/revenue-points/${pointId}/verify-code`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token: token.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResult({ valid: false, reason: data.error ?? 'Lookup failed', sale: null })
        return
      }
      setResult({ valid: data.valid, reason: data.reason ?? null, sale: data.sale ?? null })
    } catch {
      setResult({ valid: false, reason: 'Network error', sale: null })
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setToken(''); setResult(null)
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <KeyRound className="h-4 w-4" />
          Verify entry code
        </h2>
        <p className="mt-0.5 text-xs text-text-secondary">
          Enter the {pointType === 'laundry' ? 'pickup' : 'entry'} code printed on the customer&apos;s receipt or SMS.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          value={token}
          onChange={(e) => setToken(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter') verify() }}
          placeholder="ABCDEF"
          maxLength={8}
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-base font-mono tracking-[0.2em] uppercase focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <button
          onClick={verify}
          disabled={loading || token.trim().length < 4}
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-50 transition-colors"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Verify
        </button>
      </div>

      {result && (
        <div
          className={`rounded-lg border px-3 py-3 ${
            result.valid
              ? 'border-success/30 bg-success-subtle'
              : 'border-danger/30 bg-danger-subtle'
          }`}
        >
          <div className="flex items-start gap-2">
            {result.valid
              ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              : <XCircle    className="mt-0.5 h-4 w-4 shrink-0 text-danger" />}
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className={`text-sm font-semibold ${result.valid ? 'text-success' : 'text-danger'}`}>
                {result.valid ? 'Valid' : 'Not valid'}
              </p>
              {result.reason && (
                <p className="text-xs text-text-secondary">{result.reason}</p>
              )}
              {result.sale && (
                <div className="space-y-0.5 text-xs text-text-secondary">
                  <p>
                    <span className="text-text-tertiary">Customer: </span>
                    {result.sale.customer_name ?? '—'}
                  </p>
                  <p>
                    <span className="text-text-tertiary">Service: </span>
                    {result.sale.description}
                  </p>
                  <p>
                    <span className="text-text-tertiary">Amount: </span>
                    {ghs(result.sale.total_amount)}
                  </p>
                  <p>
                    <span className="text-text-tertiary">Paid: </span>
                    {new Date(result.sale.sold_at).toLocaleString()}
                  </p>
                  {result.sale.weight_kg != null && (
                    <p>
                      <span className="text-text-tertiary">Weight: </span>
                      {result.sale.weight_kg} kg
                    </p>
                  )}
                  {result.sale.duration_minutes != null && (
                    <p>
                      <span className="text-text-tertiary">Duration: </span>
                      {result.sale.duration_minutes} min
                    </p>
                  )}
                </div>
              )}
              <button
                onClick={reset}
                className="text-xs font-medium text-brand hover:underline"
              >
                Check another
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
