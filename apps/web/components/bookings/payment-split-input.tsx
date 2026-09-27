'use client'

import { Banknote, Wallet, Clock, Plus, X } from 'lucide-react'
import { formatGHS } from '@/lib/utils'
import { PAYMENT_METHOD_OPTIONS, type PaymentMethod } from '@/lib/payments/methods'

export type PaymentType = 'full' | 'part' | 'later'

export interface PaymentSplitRow {
  method:    PaymentMethod
  amountGHS: string // raw text input value, GH₵ — converted to pesewas by derivePayments()
}

export interface PaymentSplitValue {
  type: PaymentType
  rows: PaymentSplitRow[]
}

export function defaultPaymentSplitValue(): PaymentSplitValue {
  return { type: 'later', rows: [] }
}

/** The {method, amount} pesewas array the booking/extend-stay APIs expect, or undefined for 'later'. */
export function derivePayments(value: PaymentSplitValue): { method: PaymentMethod; amount: number }[] | undefined {
  if (value.type === 'later') return undefined
  return value.rows
    .map((r) => ({ method: r.method, amount: Math.round((Number(r.amountGHS) || 0) * 100) }))
    .filter((r) => r.amount > 0)
}

export function paymentSplitSum(value: PaymentSplitValue): number {
  return (derivePayments(value) ?? []).reduce((s, r) => s + r.amount, 0)
}

/** Whether the current split is submittable against the given amount due (pesewas). */
export function isPaymentSplitValid(value: PaymentSplitValue, totalDue: number): boolean {
  if (value.type === 'later') return true
  const sum = paymentSplitSum(value)
  if (sum <= 0) return false
  if (value.type === 'full') return Math.abs(sum - totalDue) <= 1 // 1 pesewa rounding tolerance
  return sum < totalDue // 'part'
}

const TYPE_OPTIONS: Array<{ value: PaymentType; label: string; icon: typeof Banknote }> = [
  { value: 'full',  label: 'Full',  icon: Banknote },
  { value: 'part',  label: 'Part',  icon: Wallet },
  { value: 'later', label: 'Later', icon: Clock },
]

/**
 * Payment Type (Full / Part / Later) + split-across-methods entry, ported
 * from AMP Lodge's booking form. Shared by the booking-creation form and
 * the extend-stay form so there's one implementation of "how did the guest
 * pay, possibly across several methods" instead of two near-identical ones.
 */
export function PaymentSplitInput({
  totalDue,
  value,
  onChange,
}: {
  /** Amount due, in pesewas. */
  totalDue: number
  value:    PaymentSplitValue
  onChange: (v: PaymentSplitValue) => void
}) {
  function setType(type: PaymentType) {
    if (type === 'later') {
      onChange({ type, rows: [] })
    } else if (value.rows.length === 0) {
      // Full pre-fills the full amount so the common case is a single click;
      // Part starts blank since there's no sensible default partial amount.
      onChange({ type, rows: [{ method: 'cash', amountGHS: type === 'full' ? (totalDue / 100).toFixed(2) : '' }] })
    } else {
      onChange({ ...value, type })
    }
  }

  function updateRow(index: number, patch: Partial<PaymentSplitRow>) {
    onChange({ ...value, rows: value.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)) })
  }

  function addRow() {
    onChange({ ...value, rows: [...value.rows, { method: 'cash', amountGHS: '' }] })
  }

  function removeRow(index: number) {
    onChange({ ...value, rows: value.rows.filter((_, i) => i !== index) })
  }

  const sum = paymentSplitSum(value)
  const remaining = totalDue - sum

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-text-primary">Payment Type</label>
        <div className="grid grid-cols-3 gap-2">
          {TYPE_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const active = value.type === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'border-success/50 bg-success-subtle text-success'
                    : 'border-border bg-surface text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon className="h-4 w-4" />
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {value.type !== 'later' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-text-primary">Payment Method</label>
          {value.rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={row.method}
                onChange={(e) => updateRow(i, { method: e.target.value as PaymentMethod })}
                className="input-base flex-1"
              >
                {PAYMENT_METHOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <div className="relative flex-1">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-text-tertiary">GH₵</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={row.amountGHS}
                  onChange={(e) => updateRow(i, { amountGHS: e.target.value })}
                  className="input-base pl-10 font-mono"
                  placeholder="0.00"
                />
              </div>
              {value.rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="shrink-0 text-text-tertiary hover:text-danger"
                  aria-label="Remove payment method"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-hover"
          >
            <Plus className="h-3.5 w-3.5" />
            Add another payment method
          </button>

          {totalDue > 0 && (
            <p className={`text-xs ${remaining === 0 ? 'text-success' : remaining < 0 ? 'text-danger' : 'text-text-tertiary'}`}>
              {remaining > 0 && `Remaining: ${formatGHS(remaining)}`}
              {remaining < 0 && `Over by ${formatGHS(-remaining)}`}
              {remaining === 0 && 'Fully covered'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
