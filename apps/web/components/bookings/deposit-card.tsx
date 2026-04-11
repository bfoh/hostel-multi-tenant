'use client'

import { useState } from 'react'
import { Shield, ShieldCheck, ShieldX, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { formatGHS } from '@/lib/utils'

interface Deposit {
  id: string
  amount: number
  method: string
  reference?: string | null
  collected_at: string
  status: 'held' | 'refunded' | 'forfeited' | 'partial_refund'
  refund_amount?: number | null
  refund_reason?: string | null
  resolved_at?: string | null
  notes?: string | null
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', card: 'Card', bank_transfer: 'Bank Transfer', cheque: 'Cheque',
  momo_mtn: 'MTN MoMo', momo_vodafone: 'Vodafone Cash', momo_airteltigo: 'AirtelTigo Money',
}

const STATUS_STYLES: Record<string, string> = {
  held:           'bg-warning-subtle text-warning-fg border-warning/20',
  refunded:       'bg-success-subtle text-success border-success/20',
  forfeited:      'bg-danger-subtle text-danger border-danger/20',
  partial_refund: 'bg-brand-subtle text-brand border-brand/20',
}
const STATUS_LABEL: Record<string, string> = {
  held: 'Held', refunded: 'Refunded', forfeited: 'Forfeited', partial_refund: 'Partial refund',
}

export function DepositCard({
  bookingId,
  occupantId,
  initialDeposit,
}: {
  bookingId: string
  occupantId: string
  initialDeposit: Deposit | null
}) {
  const [deposit, setDeposit] = useState<Deposit | null>(initialDeposit)
  const [showForm, setShowForm]     = useState(false)
  const [showResolve, setShowResolve] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // New deposit form
  const [amount, setAmount]     = useState('')
  const [method, setMethod]     = useState('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes]       = useState('')

  // Resolve form
  const [resolution, setResolution] = useState<'refunded' | 'forfeited' | 'partial_refund'>('refunded')
  const [partialAmt, setPartialAmt] = useState('')
  const [refundReason, setRefundReason] = useState('')

  async function record() {
    const amtNum = Math.round(parseFloat(amount) * 100)
    if (!amount || isNaN(amtNum) || amtNum <= 0) { setError('Enter a valid amount'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amtNum,
          method,
          reference: reference || undefined,
          notes: notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setDeposit(data)
      setShowForm(false)
      setAmount(''); setMethod('cash'); setReference(''); setNotes('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  async function resolve() {
    if (!deposit) return
    const body: Record<string, unknown> = { status: resolution, refund_reason: refundReason || undefined }
    if (resolution === 'partial_refund') {
      const amt = Math.round(parseFloat(partialAmt) * 100)
      if (!partialAmt || isNaN(amt) || amt <= 0) { setError('Enter partial refund amount'); return }
      body.refund_amount = amt
    }
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/deposits/${deposit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setDeposit(data)
      setShowResolve(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!deposit) return
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/deposits/${deposit.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed') }
      setDeposit(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {deposit ? (
        <div className="space-y-3">
          {/* Summary row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {deposit.status === 'held'
                ? <Shield className="h-4 w-4 text-warning" />
                : deposit.status === 'refunded' || deposit.status === 'partial_refund'
                ? <ShieldCheck className="h-4 w-4 text-success" />
                : <ShieldX className="h-4 w-4 text-danger" />}
              <span className="text-sm font-semibold text-text-primary currency-amount">
                {formatGHS(deposit.amount)}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[deposit.status]}`}>
                {STATUS_LABEL[deposit.status]}
              </span>
            </div>
            {deposit.status === 'held' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowResolve((p) => !p); setError(null) }}
                  className="text-xs text-brand hover:underline"
                >
                  {showResolve ? 'Cancel' : 'Resolve'}
                </button>
                <button
                  onClick={remove}
                  disabled={saving}
                  className="text-xs text-danger hover:underline disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="rounded-lg bg-surface-raised p-3 text-xs space-y-1 text-text-secondary">
            <p><span className="text-text-tertiary">Method: </span>{METHOD_LABEL[deposit.method] ?? deposit.method}</p>
            {deposit.reference && <p><span className="text-text-tertiary">Ref: </span>{deposit.reference}</p>}
            <p><span className="text-text-tertiary">Collected: </span>{new Date(deposit.collected_at).toLocaleDateString()}</p>
            {deposit.resolved_at && (
              <p><span className="text-text-tertiary">Resolved: </span>{new Date(deposit.resolved_at).toLocaleDateString()}</p>
            )}
            {deposit.refund_amount != null && (
              <p><span className="text-text-tertiary">Refunded: </span>
                <span className="currency-amount">{formatGHS(deposit.refund_amount)}</span>
                {deposit.status === 'partial_refund' && deposit.amount > 0 && (
                  <span className="ml-1 text-danger">
                    (forfeited {formatGHS(deposit.amount - deposit.refund_amount)})
                  </span>
                )}
              </p>
            )}
            {deposit.refund_reason && <p><span className="text-text-tertiary">Reason: </span>{deposit.refund_reason}</p>}
            {deposit.notes && <p><span className="text-text-tertiary">Notes: </span>{deposit.notes}</p>}
          </div>

          {/* Resolve panel */}
          {showResolve && (
            <div className="rounded-lg border border-border bg-surface-raised p-4 space-y-3">
              <p className="text-xs font-medium text-text-tertiary">Resolve deposit</p>
              <div className="grid grid-cols-3 gap-2">
                {(['refunded', 'forfeited', 'partial_refund'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setResolution(s)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      resolution === s
                        ? 'border-brand bg-brand text-brand-fg'
                        : 'border-border bg-surface text-text-secondary hover:border-brand/40'
                    }`}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
              {resolution === 'partial_refund' && (
                <input
                  type="number" step="0.01" min="0"
                  placeholder={`Refund amount (max ${(deposit.amount / 100).toFixed(2)})`}
                  value={partialAmt}
                  onChange={(e) => setPartialAmt(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                />
              )}
              <input
                placeholder="Reason (optional)"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
              {error && <p className="text-xs text-danger">{error}</p>}
              <button
                onClick={resolve}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm resolution
              </button>
            </div>
          )}
        </div>
      ) : (
        <div>
          <button
            onClick={() => { setShowForm((p) => !p); setError(null) }}
            className="flex items-center gap-1.5 text-sm text-brand hover:underline"
          >
            {showForm
              ? <><ChevronUp className="h-4 w-4" /> Cancel</>
              : <><Shield className="h-4 w-4" /> Record deposit</>}
          </button>

          {showForm && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Amount (GHS)</label>
                  <input
                    type="number" step="0.01" min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Method</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    {Object.entries(METHOD_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>
              <input
                placeholder="Reference / receipt no. (optional)"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
              <input
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
              {error && <p className="text-xs text-danger">{error}</p>}
              <button
                onClick={record}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Record deposit
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
