'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface SupplierOption { id: string; name: string; payment_terms_days: number; default_expense_account_id: string | null }
interface ExpenseAccount { id: string; code: string; name: string }

const CATEGORIES = [
  'utilities','repairs','salaries','supplies','maintenance',
  'marketing','insurance','rent','equipment','other',
] as const

export function NewRecurringBillForm({
  suppliers,
  expenseAccounts,
}: {
  suppliers:       SupplierOption[]
  expenseAccounts: ExpenseAccount[]
}) {
  const router = useRouter()
  const today = new Date()
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString().slice(0, 10)

  const [supplierId, setSupplierId]   = useState('')
  const [vendor, setVendor]           = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]       = useState<typeof CATEGORIES[number]>('utilities')
  const [amount, setAmount]           = useState('')
  const [expenseAcct, setExpenseAcct] = useState('')
  const [frequency, setFrequency]     = useState<'monthly' | 'quarterly' | 'yearly'>('monthly')
  const [dayOfMonth, setDayOfMonth]   = useState('1')
  const [dueOffset, setDueOffset]     = useState('30')
  const [nextRun, setNextRun]         = useState(nextMonth)
  const [notes, setNotes]             = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)

  function onSupplierChange(id: string) {
    setSupplierId(id)
    if (!id) return
    const s = suppliers.find((x) => x.id === id)
    if (!s) return
    setVendor(s.name)
    setDueOffset(String(s.payment_terms_days))
    if (s.default_expense_account_id) setExpenseAcct(s.default_expense_account_id)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const amtNum = parseFloat(amount)
    if (!Number.isFinite(amtNum) || amtNum <= 0) { setError('Amount must be > 0'); return }
    const dayNum   = parseInt(dayOfMonth, 10)
    const dueNum   = parseInt(dueOffset, 10)
    if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 31) { setError('Day of month must be 1..31'); return }
    if (!Number.isInteger(dueNum) || dueNum < 0) { setError('Due offset must be ≥ 0'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/accounting/recurring/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id:        supplierId || undefined,
          vendor_name:        vendor.trim(),
          description:        description.trim(),
          category,
          amount:             Math.round(amtNum * 100),
          expense_account_id: expenseAcct || undefined,
          frequency,
          day_of_month:       dayNum,
          due_day_offset:     dueNum,
          next_run_date:      nextRun,
          notes:              notes.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? `Failed (${res.status})`); setSubmitting(false); return }
      router.push('/accounting/recurring')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-5 space-y-4">
      {suppliers.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Supplier (optional)</label>
          <select
            value={supplierId}
            onChange={(e) => onSupplierChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
          >
            <option value="">— Free-text vendor —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Vendor name *</label>
          <input
            type="text" value={vendor} onChange={(e) => setVendor(e.target.value)} required
            placeholder="e.g. ECG"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Category *</label>
          <select
            value={category} onChange={(e) => setCategory(e.target.value as typeof CATEGORIES[number])}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm capitalize focus:border-brand focus:outline-none"
          >
            {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Description *</label>
        <input
          type="text" value={description} onChange={(e) => setDescription(e.target.value)} required
          placeholder="e.g. Monthly electricity"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Amount per period (GHS) *</label>
          <input
            type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required
            placeholder="0.00"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-right text-sm tabular-nums focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Expense account</label>
          <select
            value={expenseAcct} onChange={(e) => setExpenseAcct(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
          >
            <option value="">Default (5050)</option>
            {expenseAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Frequency</label>
          <select
            value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Day of month</label>
          <input
            type="number" min="1" max="31" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-right text-sm tabular-nums focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Due offset (days)</label>
          <input
            type="number" min="0" value={dueOffset} onChange={(e) => setDueOffset(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-right text-sm tabular-nums focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">First run</label>
          <input
            type="date" value={nextRun} onChange={(e) => setNextRun(e.target.value)} required
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Notes</label>
        <textarea
          value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">{error}</div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Create template
        </button>
      </div>
    </form>
  )
}
