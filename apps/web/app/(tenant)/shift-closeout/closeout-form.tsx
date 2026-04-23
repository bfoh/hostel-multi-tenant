'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react'

export function ShiftCloseoutForm({ today }: { today: string }) {
  const router = useRouter()
  const [declaredCash, setDeclaredCash] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/shift-closeout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          declared_cash: Math.round(parseFloat(declaredCash) * 100), // GHS → pesewas
          shift_date: today,
          notes: notes || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to submit')
      setResult(json)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 space-y-5">
      <h2 className="font-semibold text-text-primary">End of Shift — {today}</h2>
      <p className="text-sm text-text-secondary">
        Count the cash in your register and enter the total below. The system will
        compare it against all cash payments recorded during your shift.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">
            Declared Cash Amount (GH₵)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={declaredCash}
            onChange={(e) => setDeclaredCash(e.target.value)}
            required
            placeholder="e.g. 450.00"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-primary placeholder:text-text-disabled focus:border-brand focus:ring-1 focus:ring-brand"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any notes about the shift..."
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-primary placeholder:text-text-disabled focus:border-brand focus:ring-1 focus:ring-brand"
          />
        </div>

        <button
          type="submit"
          disabled={busy || !declaredCash}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit Close-Out
        </button>
      </form>

      {error && <p className="text-sm text-danger">{error}</p>}

      {result && (
        <div className={`rounded-lg border p-4 space-y-2 ${
          result.discrepancy === 0
            ? 'border-success/30 bg-success/5'
            : 'border-warning/30 bg-warning/5'
        }`}>
          <div className="flex items-center gap-2">
            {result.discrepancy === 0 ? (
              <CheckCircle className="h-5 w-5 text-success" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-warning" />
            )}
            <h3 className="font-semibold text-text-primary">
              {result.discrepancy === 0 ? 'Cash matches!' : 'Discrepancy detected'}
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-text-tertiary">System Cash</p>
              <p className="font-mono font-semibold text-text-primary">
                GH₵ {(result.system_cash / 100).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary">You Declared</p>
              <p className="font-mono font-semibold text-text-primary">
                GH₵ {(result.declared_cash / 100).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary">Discrepancy</p>
              <p className={`font-mono font-semibold ${
                result.discrepancy === 0 ? 'text-success' : 'text-danger'
              }`}>
                {result.discrepancy === 0
                  ? '—'
                  : `${result.discrepancy > 0 ? '+' : ''}GH₵ ${(result.discrepancy / 100).toFixed(2)}`}
              </p>
            </div>
          </div>
          <p className="text-xs text-text-secondary">
            {result.payment_count} cash payment{result.payment_count !== 1 ? 's' : ''} recorded today ·
            Digital: GH₵ {(result.system_digital / 100).toFixed(2)}
          </p>
        </div>
      )}
    </div>
  )
}
