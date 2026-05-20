'use client'

import { useState, useMemo } from 'react'
import { Plus, Loader2, Trash2, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatGHS } from '@/lib/utils'

interface Expense {
  id: string; category: string; description: string; vendor: string | null
  amount: number; expense_date: string; payment_method: string | null
  reference: string | null; notes: string | null
  currency_code?: string | null
  original_amount?: number | null
  fx_rate_used?: number | null
}

interface FxRate { code: string; rate: number; asOf: string }

const CATEGORIES = [
  'utilities','repairs','salaries','supplies','maintenance',
  'marketing','insurance','rent','equipment','other',
]
const CAT_COLORS: Record<string, string> = {
  utilities:   'bg-blue-100 text-blue-700',
  repairs:     'bg-orange-100 text-orange-700',
  salaries:    'bg-purple-100 text-purple-700',
  supplies:    'bg-yellow-100 text-yellow-700',
  maintenance: 'bg-red-100 text-red-700',
  marketing:   'bg-pink-100 text-pink-700',
  insurance:   'bg-teal-100 text-teal-700',
  rent:        'bg-indigo-100 text-indigo-700',
  equipment:   'bg-cyan-100 text-cyan-700',
  other:       'bg-gray-100 text-gray-700',
}

export function ExpensesClient({
  initialExpenses,
  fxRates = [],
}: {
  initialExpenses: Expense[]
  fxRates?:        FxRate[]
}) {
  const [expenses, setExpenses] = useState(initialExpenses)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [filterCat, setFilterCat] = useState('all')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo]   = useState('')

  // Form state
  const [cat, setCat]       = useState('utilities')
  const [desc, setDesc]     = useState('')
  const [vendor, setVendor] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate]     = useState(new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState('')
  const [ref, setRef]       = useState('')
  const [notes, setNotes]   = useState('')
  const [currency, setCurrency]         = useState<string>('GHS')
  const [rateOverride, setRateOverride] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const amtNum = parseFloat(amount)
      if (!Number.isFinite(amtNum) || amtNum <= 0) throw new Error('Invalid amount')

      const fxRate = fxRates.find((r) => r.code === currency)
      const effectiveRate = currency === 'GHS'
        ? 1
        : rateOverride
        ? parseFloat(rateOverride)
        : fxRate?.rate ?? 0
      if (currency !== 'GHS' && (!effectiveRate || effectiveRate <= 0)) {
        throw new Error(`No FX rate for ${currency} — capture one under FX Rates or set an override`)
      }

      const ghsPesewas      = Math.round(amtNum * effectiveRate * 100)
      const originalPesewas = Math.round(amtNum * 100)

      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category:        cat,
          description:     desc,
          vendor:          vendor || undefined,
          amount:          ghsPesewas,
          expense_date:    date,
          payment_method:  method || undefined,
          reference:       ref || undefined,
          notes:           notes || undefined,
          currency_code:   currency,
          original_amount: currency === 'GHS' ? undefined : originalPesewas,
          fx_rate_used:    currency === 'GHS' ? undefined : effectiveRate,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setExpenses((prev) => [data, ...prev])
      setShowForm(false)
      setDesc(''); setVendor(''); setAmount(''); setMethod(''); setRef(''); setNotes('')
      setCurrency('GHS'); setRateOverride('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this expense?')) return
    setDeletingId(id)
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    setExpenses((prev) => prev.filter((e) => e.id !== id))
    setDeletingId(null)
  }

  const filtered = useMemo(() => expenses.filter((e) => {
    if (filterCat !== 'all' && e.category !== filterCat) return false
    if (filterFrom && e.expense_date < filterFrom) return false
    if (filterTo   && e.expense_date > filterTo)   return false
    return true
  }), [expenses, filterCat, filterFrom, filterTo])

  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0)

  // Category breakdown
  const breakdown = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of filtered) map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [filtered])

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-danger" />
              <p className="text-xs text-text-tertiary">Total (filtered)</p>
            </div>
            <p className="text-lg font-bold text-text-primary">{formatGHS(totalFiltered)}</p>
          </CardContent>
        </Card>
        {breakdown.slice(0, 3).map(([cat, amt]) => (
          <Card key={cat}>
            <CardContent className="py-4">
              <p className="text-xs text-text-tertiary capitalize mb-1">{cat}</p>
              <p className="text-lg font-bold text-text-primary">{formatGHS(amt)}</p>
              <p className="text-xs text-text-disabled">{totalFiltered > 0 ? Math.round((amt / totalFiltered) * 100) : 0}% of total</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters + Add */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-text-tertiary">Category</label>
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand">
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-text-tertiary">From</label>
          <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-text-tertiary">To</label>
          <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
        </div>
        <button onClick={() => setShowForm((v) => !v)}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors">
          <Plus className="h-4 w-4" />
          Add expense
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle>Log expense</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Category</label>
                  <select value={cat} onChange={(e) => setCat(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand capitalize">
                    {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Amount ({currency})</label>
                  <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="0.00"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Date</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
                </div>
              </div>

              {/* Currency row */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Currency</label>
                  <select value={currency} onChange={(e) => { setCurrency(e.target.value); setRateOverride('') }}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand">
                    <option value="GHS">GHS (base)</option>
                    {fxRates.map((r) => <option key={r.code} value={r.code}>{r.code}</option>)}
                  </select>
                </div>
                {currency !== 'GHS' && (
                  <div>
                    <label className="mb-1 block text-xs text-text-tertiary">
                      Rate to GHS{' '}
                      {fxRates.find((r) => r.code === currency) && (
                        <span className="text-text-disabled">
                          (latest {fxRates.find((r) => r.code === currency)!.rate.toFixed(4)})
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      value={rateOverride}
                      onChange={(e) => setRateOverride(e.target.value)}
                      placeholder={fxRates.find((r) => r.code === currency)?.rate.toFixed(4) ?? 'Set FX rate first'}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </div>
                )}
                {currency !== 'GHS' && amount && (
                  <div className="rounded-lg bg-surface-raised px-3 py-2 text-xs text-text-secondary self-end">
                    = <strong className="text-text-primary tabular-nums">
                      GH₵ {(
                        parseFloat(amount) *
                        (rateOverride ? parseFloat(rateOverride) : fxRates.find((r) => r.code === currency)?.rate ?? 0)
                      ).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-tertiary">Description</label>
                <input value={desc} onChange={(e) => setDesc(e.target.value)} required maxLength={500} placeholder="What was this expense for?"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Vendor</label>
                  <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Optional"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Payment method</label>
                  <select value={method} onChange={(e) => setMethod(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand">
                    <option value="">— Select —</option>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="momo">MoMo</option>
                    <option value="card">Card</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Reference</label>
                  <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Receipt / ref no."
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Notes</label>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
                </div>
              </div>
              {error && <p className="text-xs text-danger">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save expense
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-tertiary">No expenses found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Vendor</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary">Amount</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((e) => (
                    <tr key={e.id} className="hover:bg-surface-raised transition-colors">
                      <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{e.expense_date}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${CAT_COLORS[e.category] ?? 'bg-gray-100 text-gray-600'}`}>
                          {e.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-primary max-w-xs truncate">
                        {e.description}
                        {e.currency_code && e.currency_code !== 'GHS' && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-brand/10 px-1.5 py-0 text-[10px] font-semibold text-brand">
                            {e.currency_code}
                            {e.original_amount && (
                              <span className="text-text-tertiary font-normal">
                                {(e.original_amount / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{e.vendor ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-text-primary">{formatGHS(e.amount)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => remove(e.id)} disabled={deletingId === e.id}
                          className="p-1 text-text-disabled hover:text-danger transition-colors">
                          {deletingId === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-surface-raised">
                    <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-text-primary">Total</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-text-primary">{formatGHS(totalFiltered)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
