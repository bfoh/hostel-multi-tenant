'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Banknote } from 'lucide-react'

interface ExpenseAccount { id: string; code: string; name: string }
interface FxRate { code: string; rate: number; asOf: string }
interface SupplierOption {
  id:                          string
  name:                        string
  phone:                       string | null
  email:                       string | null
  payment_terms_days:          number
  default_expense_account_id:  string | null
  default_currency:            string
}

const CATEGORIES = [
  'utilities','repairs','salaries','supplies','maintenance',
  'marketing','insurance','rent','equipment','other',
] as const

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function NewBillForm({
  expenseAccounts,
  fxRates,
  suppliers = [],
  preselectSupplierId,
}: {
  expenseAccounts:     ExpenseAccount[]
  fxRates:             FxRate[]
  suppliers?:          SupplierOption[]
  preselectSupplierId?:string
}) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)

  const preselect = preselectSupplierId
    ? suppliers.find((s) => s.id === preselectSupplierId)
    : undefined
  const due30 = addDays(today, preselect?.payment_terms_days ?? 30)

  const [supplierId, setSupplierId]       = useState(preselect?.id ?? '')
  const [vendorName, setVendorName]       = useState(preselect?.name ?? '')
  const [vendorContact, setVendorContact] = useState(preselect?.phone ?? preselect?.email ?? '')
  const [billNumber, setBillNumber]       = useState('')
  const [billDate, setBillDate]           = useState(today)
  const [dueDate, setDueDate]             = useState(due30)
  const [category, setCategory]           = useState<typeof CATEGORIES[number]>('utilities')
  const [description, setDescription]     = useState('')
  const [currency, setCurrency]           = useState<string>(preselect?.default_currency ?? 'GHS')
  const [rateOverride, setRateOverride]   = useState('')
  const [amount, setAmount]               = useState('')
  const [expenseAcct, setExpenseAcct]     = useState(preselect?.default_expense_account_id ?? '')
  const [notes, setNotes]                 = useState('')
  const [submitting, setSubmitting]       = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  function onSupplierChange(id: string) {
    setSupplierId(id)
    if (!id) return
    const s = suppliers.find((x) => x.id === id)
    if (!s) return
    setVendorName(s.name)
    if (s.phone || s.email) setVendorContact(s.phone ?? s.email ?? '')
    setCurrency(s.default_currency)
    if (s.default_expense_account_id) setExpenseAcct(s.default_expense_account_id)
    setDueDate(addDays(billDate, s.payment_terms_days))
  }

  const fxRate = useMemo(() => fxRates.find((r) => r.code === currency), [fxRates, currency])
  const effectiveRate = currency === 'GHS'
    ? 1
    : rateOverride
    ? parseFloat(rateOverride)
    : fxRate?.rate ?? 0

  const amtNum = parseFloat(amount)
  const validAmount = Number.isFinite(amtNum) && amtNum > 0
  const ghsAmount = validAmount && effectiveRate > 0 ? amtNum * effectiveRate : 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!validAmount) { setError('Amount must be greater than 0'); return }
    if (currency !== 'GHS' && (!effectiveRate || effectiveRate <= 0)) {
      setError(`No FX rate available for ${currency}. Capture one in FX Rates first or set an override.`)
      return
    }

    const ghsPesewas       = Math.round(ghsAmount * 100)
    const originalPesewas  = Math.round(amtNum * 100)

    setSubmitting(true)
    try {
      const res = await fetch('/api/accounting/ap/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id:        supplierId || undefined,
          vendor_name:        vendorName.trim(),
          vendor_contact:     vendorContact.trim() || undefined,
          bill_number:        billNumber.trim() || undefined,
          bill_date:          billDate,
          due_date:           dueDate,
          category,
          description:        description.trim(),
          amount:             ghsPesewas,
          currency_code:      currency,
          original_amount:    currency === 'GHS' ? undefined : originalPesewas,
          fx_rate_used:       currency === 'GHS' ? undefined : effectiveRate,
          expense_account_id: expenseAcct || undefined,
          notes:              notes.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`)
        setSubmitting(false)
        return
      }
      router.push(`/accounting/ap/${data.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        {suppliers.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Pick from suppliers (optional)</label>
            <select
              value={supplierId}
              onChange={(e) => onSupplierChange(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
            >
              <option value="">— Free-text vendor —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.default_currency !== 'GHS' ? ` (${s.default_currency})` : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-text-tertiary">
              Picking a supplier prefills contact, currency, expense account, and the due date based on their payment terms.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Vendor name *</label>
            <input
              type="text"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              required
              placeholder="e.g. ECG"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Contact (phone / email)</label>
            <input
              type="text"
              value={vendorContact}
              onChange={(e) => setVendorContact(e.target.value)}
              placeholder="optional"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Bill number</label>
            <input
              type="text"
              value={billNumber}
              onChange={(e) => setBillNumber(e.target.value)}
              placeholder="optional"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Bill date *</label>
            <input
              type="date"
              value={billDate}
              max={today}
              onChange={(e) => setBillDate(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Due date *</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Category *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof CATEGORIES[number])}
              required
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none capitalize"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Expense account (overrides default)</label>
            <select
              value={expenseAcct}
              onChange={(e) => setExpenseAcct(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
            >
              <option value="">Use category default (5050)</option>
              {expenseAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Description *</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="What is being billed for?"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      {/* Currency + amount block */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Banknote className="h-3.5 w-3.5 text-brand" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Amount</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_2fr_1fr]">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => { setCurrency(e.target.value); setRateOverride('') }}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
            >
              <option value="GHS">GHS (base)</option>
              {fxRates.map((r) => (
                <option key={r.code} value={r.code}>{r.code}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Amount ({currency}) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="0.00"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-right text-sm text-text-primary tabular-nums focus:border-brand focus:outline-none"
            />
          </div>
          {currency !== 'GHS' && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Rate to GHS {fxRate && <span className="text-text-tertiary">(latest {fxRate.rate.toFixed(4)})</span>}
              </label>
              <input
                type="number"
                step="0.0001"
                min="0.0001"
                value={rateOverride}
                onChange={(e) => setRateOverride(e.target.value)}
                placeholder={fxRate ? fxRate.rate.toFixed(4) : 'Set FX rate first'}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-right text-sm tabular-nums focus:border-brand focus:outline-none"
              />
            </div>
          )}
        </div>

        {currency !== 'GHS' && (
          <div className="rounded-lg bg-surface-raised px-3 py-2 text-xs text-text-secondary flex flex-wrap items-center justify-between gap-2">
            <span>
              {validAmount && effectiveRate > 0
                ? <>= <strong className="text-text-primary tabular-nums">GH₵ {ghsAmount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> at rate {effectiveRate.toFixed(4)}{fxRate ? ` (captured ${fxRate.asOf})` : ''}</>
                : fxRate
                ? `Will convert at ${fxRate.rate.toFixed(4)} ${currency} → 1 GHS (captured ${fxRate.asOf})`
                : <span className="text-warning">No rate captured for {currency} — set an override above or add one under FX Rates.</span>}
            </span>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save as draft
        </button>
      </div>
    </form>
  )
}
