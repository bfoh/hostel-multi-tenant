'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { COMMON_FOREIGN_CURRENCIES } from '@/lib/data/fx'
import type { Supplier } from '@/lib/data/suppliers'

interface ExpenseAccount { id: string; code: string; name: string }

export function SupplierForm({
  expenseAccounts,
  initial,
}: {
  expenseAccounts: ExpenseAccount[]
  initial?:        Supplier
}) {
  const router = useRouter()
  const isEdit = Boolean(initial)

  const [name, setName]           = useState(initial?.name ?? '')
  const [contact, setContact]     = useState(initial?.contact_name ?? '')
  const [phone, setPhone]         = useState(initial?.phone ?? '')
  const [email, setEmail]         = useState(initial?.email ?? '')
  const [address, setAddress]     = useState(initial?.address ?? '')
  const [tin, setTin]             = useState(initial?.tin ?? '')
  const [terms, setTerms]         = useState((initial?.payment_terms_days ?? 30).toString())
  const [defaultAcct, setDefaultAcct] = useState(initial?.default_expense_account_id ?? '')
  const [currency, setCurrency]   = useState(initial?.default_currency ?? 'GHS')
  const [notes, setNotes]         = useState(initial?.notes ?? '')
  const [active, setActive]       = useState(initial?.is_active ?? true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const termsNum = parseInt(terms, 10)
    if (!Number.isInteger(termsNum) || termsNum < 0) { setError('Payment terms must be ≥ 0 days'); return }

    setSubmitting(true)
    try {
      const url    = isEdit ? `/api/accounting/suppliers/${initial!.id}` : '/api/accounting/suppliers'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          contact_name:               contact.trim() || null,
          phone:                      phone.trim()   || null,
          email:                      email.trim()   || null,
          address:                    address.trim() || null,
          tin:                        tin.trim()     || null,
          payment_terms_days:         termsNum,
          default_expense_account_id: defaultAcct || null,
          default_currency:           currency,
          notes:                      notes.trim()   || null,
          ...(isEdit ? { is_active: active } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? `Failed (${res.status})`); setSubmitting(false); return }
      if (!isEdit) router.push(`/accounting/suppliers/${data.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Contact person</label>
          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+233…"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Address</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Ghana TIN</label>
          <input
            type="text"
            value={tin}
            onChange={(e) => setTin(e.target.value)}
            placeholder="P0001234567"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Payment terms (days)</label>
          <input
            type="number"
            min="0"
            step="1"
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-right text-sm tabular-nums focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Default currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
          >
            <option value="GHS">GHS</option>
            {COMMON_FOREIGN_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Default expense account</label>
        <select
          value={defaultAcct}
          onChange={(e) => setDefaultAcct(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
        >
          <option value="">— Prompt at bill time —</option>
          {expenseAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </div>

      {isEdit && (
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="rounded border-border text-brand focus:ring-brand"
          />
          Active (uncheck to hide from bill capture pickers)
        </label>
      )}

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
          {isEdit ? 'Save changes' : 'Create supplier'}
        </button>
      </div>
    </form>
  )
}
