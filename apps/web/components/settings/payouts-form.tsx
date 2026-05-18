'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, AlertTriangle, Landmark } from 'lucide-react'

interface Bank {
  name: string
  code: string
}

interface PayoutsState {
  connected: boolean
  subaccount_code: string | null
  bank_code: string | null
  account_number: string | null
  settlement_bank: string | null
  account_name: string | null
  connected_at: string | null
  paystack_status: { active: boolean } | null
}

export function PayoutsForm({ initial }: { initial: PayoutsState }) {
  const router = useRouter()

  const [banks, setBanks]               = useState<Bank[]>([])
  const [banksLoading, setBanksLoading] = useState(true)
  const [banksError, setBanksError]     = useState<string | null>(null)

  const [bankCode, setBankCode]         = useState(initial.bank_code ?? '')
  const [accountNumber, setAccountNumber] = useState(initial.account_number ?? '')

  const [resolving, setResolving]       = useState(false)
  const [resolvedName, setResolvedName] = useState<string | null>(initial.account_name)
  const [resolveError, setResolveError] = useState<string | null>(null)
  // Paystack's /bank/resolve only works reliably for Nigerian banks and Ghana
  // mobile money. Most Ghanaian commercial bank accounts can't be auto-verified,
  // so we let the user type the holder name by hand when resolution fails.
  const [manualName, setManualName]     = useState<string>(initial.account_name ?? '')

  const [saving, setSaving]             = useState(false)
  const [saveError, setSaveError]       = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess]   = useState(false)

  // Load banks once
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/settings/payouts/banks')
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error(json.error ?? 'Failed to load banks')
        setBanks(json.banks as Bank[])
      } catch (e: any) {
        if (!cancelled) setBanksError(e.message)
      } finally {
        if (!cancelled) setBanksLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Auto-resolve when both fields look valid
  useEffect(() => {
    const digits = accountNumber.replace(/\s/g, '')
    if (!bankCode || digits.length < 8) {
      setResolvedName(null)
      setResolveError(null)
      return
    }

    let cancelled = false
    setResolving(true)
    setResolveError(null)

    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/settings/payouts/resolve-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bank_code: bankCode, account_number: digits }),
        })
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Account could not be verified')
        setResolvedName(json.account_name)
      } catch (e: any) {
        if (!cancelled) { setResolveError(e.message); setResolvedName(null) }
      } finally {
        if (!cancelled) setResolving(false)
      }
    }, 400)

    return () => { cancelled = true; clearTimeout(t) }
  }, [bankCode, accountNumber])

  // Use the auto-resolved name if Paystack returned one, otherwise the name
  // the user typed manually. Paystack creates the subaccount based on
  // bank_code + account_number — the name is just stored locally for display.
  const effectiveName = (resolvedName ?? manualName).trim()

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)
    setSaveSuccess(false)

    if (!bankCode || !accountNumber || effectiveName.length < 2) {
      setSaveError('Select a bank, enter the account number, and provide the account holder name.')
      return
    }

    const bank = banks.find((b) => b.code === bankCode)
    setSaving(true)
    try {
      const res = await fetch('/api/settings/payouts/subaccount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bank_code:       bankCode,
          account_number:  accountNumber,
          account_name:    effectiveName,
          settlement_bank: bank?.name ?? '',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Save failed')
      setSaveSuccess(true)
      router.refresh()
    } catch (e: any) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {/* Current status */}
      {initial.connected && (
        <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/5 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
          <div className="text-sm">
            <p className="font-medium text-text-primary">Payouts connected</p>
            <p className="text-text-secondary">
              {initial.settlement_bank} •••• {initial.account_number?.slice(-4)} — {initial.account_name}
            </p>
            {initial.paystack_status && !initial.paystack_status.active && (
              <p className="mt-1 text-xs text-danger">
                Paystack reports this subaccount is inactive. Update the details below.
              </p>
            )}
          </div>
        </div>
      )}

      {!initial.connected && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          <div className="text-sm">
            <p className="font-medium text-text-primary">Payouts not configured</p>
            <p className="text-text-secondary">
              Online guest payments are disabled until you connect a bank account.
              Funds settle straight to the account below — the platform takes no cut of transactions.
            </p>
          </div>
        </div>
      )}

      {/* Bank picker */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-text-primary">Bank</label>
        <select
          value={bankCode}
          onChange={(e) => setBankCode(e.target.value)}
          disabled={banksLoading}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-60"
        >
          <option value="">{banksLoading ? 'Loading banks…' : 'Select a bank'}</option>
          {banks.map((b) => (
            <option key={b.code} value={b.code}>{b.name}</option>
          ))}
        </select>
        {banksError && <p className="text-xs text-danger">{banksError}</p>}
      </div>

      {/* Account number */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-text-primary">Account number</label>
        <input
          type="text"
          inputMode="numeric"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
          placeholder="e.g. 1234567890123"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />

        {/* Resolution feedback */}
        {resolving && (
          <p className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Loader2 className="h-3 w-3 animate-spin" />
            Verifying account…
          </p>
        )}
        {resolvedName && !resolving && (
          <p className="flex items-center gap-1.5 text-xs text-success">
            <CheckCircle2 className="h-3 w-3" />
            <span className="font-medium">{resolvedName}</span>
          </p>
        )}
        {resolveError && !resolving && (
          <p className="text-xs text-text-secondary">
            Couldn&apos;t auto-verify with the bank. Type the account holder name below and continue.
          </p>
        )}
      </div>

      {/* Manual account-name input — only shown when auto-resolution failed.
          Paystack's /bank/resolve mostly covers Nigerian banks + Ghana MoMo;
          for Ghanaian commercial bank accounts the user types the name. */}
      {resolveError && !resolving && bankCode && accountNumber.length >= 8 && (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-text-primary">
            Account holder name
          </label>
          <input
            type="text"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="As it appears on the bank statement"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <p className="text-xs text-text-tertiary">
            Used for display only. Paystack will verify the account when funds are settled.
          </p>
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-text-secondary flex items-center gap-1.5">
          <Landmark className="h-3.5 w-3.5" />
          100% of each guest payment settles to this account.
        </div>
        <button
          type="submit"
          disabled={saving || !bankCode || accountNumber.length < 8 || effectiveName.length < 2}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {initial.connected ? 'Update payout bank' : 'Connect bank'}
        </button>
      </div>

      {saveError   && <p className="text-sm text-danger">{saveError}</p>}
      {saveSuccess && <p className="text-sm text-success">Saved. Online payments are live.</p>}
    </form>
  )
}
