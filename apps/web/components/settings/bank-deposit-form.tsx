'use client'

import { useState } from 'react'
import { Banknote, Check, Loader2 } from 'lucide-react'

interface Props {
  tenantId: string
  initial: {
    bank_name:             string | null
    bank_branch:           string | null
    bank_account_name:     string | null
    bank_account_number:   string | null
    bank_swift_code:       string | null
    bank_instructions:     string | null
    bank_deposits_enabled: boolean
  }
  canEdit: boolean
}

const INPUT_CLS =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm ' +
  'focus:border-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60'

export function BankDepositForm({ tenantId: _tenantId, initial, canEdit }: Props) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null); setSaved(false)
    try {
      const res = await fetch('/api/settings/branding', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const requiredMissing =
    !form.bank_name || !form.bank_account_name || !form.bank_account_number

  return (
    <form onSubmit={save} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <Banknote className="h-4 w-4 text-slate-400" />
            Bank Deposit Details
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Shown to residents on the payment page when they choose &quot;Pay by bank deposit.&quot;
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            checked={form.bank_deposits_enabled}
            disabled={!canEdit || requiredMissing}
            onChange={e => update('bank_deposits_enabled', e.target.checked)}
            className="h-4 w-4"
          />
          Enabled
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Bank name *">
          <input className={INPUT_CLS} value={form.bank_name ?? ''} onChange={e => update('bank_name', e.target.value || null)} disabled={!canEdit} maxLength={120} />
        </Field>
        <Field label="Branch">
          <input className={INPUT_CLS} value={form.bank_branch ?? ''} onChange={e => update('bank_branch', e.target.value || null)} disabled={!canEdit} maxLength={120} />
        </Field>
        <Field label="Account name *">
          <input className={INPUT_CLS} value={form.bank_account_name ?? ''} onChange={e => update('bank_account_name', e.target.value || null)} disabled={!canEdit} maxLength={120} />
        </Field>
        <Field label="Account number *">
          <input className={`${INPUT_CLS} font-mono`} value={form.bank_account_number ?? ''} onChange={e => update('bank_account_number', e.target.value || null)} disabled={!canEdit} pattern="[0-9 -]{6,40}" />
        </Field>
        <Field label="SWIFT / BIC (optional)">
          <input
            className={`${INPUT_CLS} font-mono`}
            value={form.bank_swift_code ?? ''}
            onChange={e => {
              const v = e.target.value
              update('bank_swift_code', v ? v.toUpperCase() : null)
            }}
            disabled={!canEdit}
            maxLength={11}
          />
        </Field>
        <Field label="Deposit instructions (optional, ≤280 chars)">
          <textarea className={`${INPUT_CLS} min-h-[68px]`} value={form.bank_instructions ?? ''} onChange={e => update('bank_instructions', e.target.value || null)} disabled={!canEdit} maxLength={280} />
        </Field>
      </div>

      {requiredMissing && (
        <p className="text-xs text-amber-600">Fill bank name, account name, and account number to enable deposits.</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {canEdit && (
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
          {saved ? 'Saved' : 'Save bank details'}
        </button>
      )}
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  )
}
