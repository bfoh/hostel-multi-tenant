'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, Wallet } from 'lucide-react'

import { formatGHS } from '@/lib/utils'
import type { BillStatus } from '@/lib/data/ap'

const METHODS = ['cash','bank_transfer','momo','card','cheque'] as const

export function BillActionsPanel({
  billId,
  status,
  outstanding,
}: {
  billId:      string
  status:      BillStatus
  outstanding: number
}) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)

  const [approving, setApproving]     = useState(false)
  const [paying, setPaying]           = useState(false)
  const [showPayForm, setShowPayForm] = useState(false)
  const [amount, setAmount]           = useState((outstanding / 100).toFixed(2))
  const [paidAt, setPaidAt]           = useState(today)
  const [method, setMethod]           = useState<typeof METHODS[number]>('bank_transfer')
  const [reference, setReference]     = useState('')
  const [notes, setNotes]             = useState('')
  const [error, setError]             = useState<string | null>(null)

  async function approve() {
    setApproving(true); setError(null)
    try {
      const res = await fetch(`/api/accounting/ap/bills/${billId}/approve`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? `Failed (${res.status})`); setApproving(false); return }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
      setApproving(false)
    }
  }

  async function pay(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const amtNum = parseFloat(amount)
    if (!Number.isFinite(amtNum) || amtNum <= 0) { setError('Amount must be > 0'); return }
    const cents = Math.round(amtNum * 100)
    if (cents > outstanding) { setError(`Cannot exceed outstanding ${formatGHS(outstanding)}`); return }

    setPaying(true)
    try {
      const res = await fetch(`/api/accounting/ap/bills/${billId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount:         cents,
          paid_at:        paidAt,
          payment_method: method,
          reference:      reference.trim() || undefined,
          notes:          notes.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? `Failed (${res.status})`); setPaying(false); return }
      router.refresh()
      setShowPayForm(false)
      setPaying(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
      setPaying(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="border-b border-border bg-surface-raised px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Actions</h2>
      </div>

      <div className="p-4 space-y-3">
        {status === 'draft' && (
          <button
            type="button"
            onClick={approve}
            disabled={approving}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Approve & post to journal
          </button>
        )}

        {(status === 'approved' || status === 'partial') && outstanding > 0 && (
          <>
            {!showPayForm && (
              <button
                type="button"
                onClick={() => setShowPayForm(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
              >
                <Wallet className="h-4 w-4" />
                Record payment
              </button>
            )}

            {showPayForm && (
              <form onSubmit={pay} className="space-y-3 rounded-lg border border-border bg-surface-raised p-3">
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">Amount (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-right text-sm tabular-nums focus:border-brand focus:outline-none"
                  />
                  <p className="mt-1 text-[10px] text-text-tertiary">Outstanding: {formatGHS(outstanding)}</p>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">Paid on</label>
                  <input
                    type="date"
                    value={paidAt}
                    max={today}
                    onChange={(e) => setPaidAt(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">Method</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as typeof METHODS[number])}
                    className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm capitalize focus:border-brand focus:outline-none"
                  >
                    {METHODS.map((m) => (
                      <option key={m} value={m}>{m.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">Reference</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Cheque #, MoMo txn id…"
                    className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={paying}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {paying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Post payment
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowPayForm(false); setError(null) }}
                    disabled={paying}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {status === 'paid' && (
          <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success inline-flex items-center gap-2 w-full justify-center">
            <CheckCircle2 className="h-4 w-4" />
            Settled in full
          </div>
        )}

        {status === 'cancelled' && (
          <p className="text-sm text-text-tertiary text-center">Bill cancelled — no further actions.</p>
        )}

        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
