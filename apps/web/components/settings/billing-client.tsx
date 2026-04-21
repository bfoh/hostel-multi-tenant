'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Check, CreditCard, AlertTriangle } from 'lucide-react'

interface Plan {
  name: 'starter' | 'growth' | 'pro'
  displayName: string
  description: string
  amountPesewas: number
  features: string[]
  available: boolean
}

interface Subscription {
  id: string
  plan_name: string
  amount: number
  currency: string
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'
  current_period_end: string | null
  next_payment_at: string | null
  canceled_at: string | null
}

interface Props {
  plans: Plan[]
  subscription: Subscription | null
}

const STATUS_STYLE: Record<string, string> = {
  active:     'bg-success/10 text-success border-success/30',
  trialing:   'bg-brand/10 text-brand border-brand/30',
  past_due:   'bg-warning/10 text-warning border-warning/30',
  canceled:   'bg-surface-sunken text-text-secondary border-border',
  incomplete: 'bg-warning/10 text-warning border-warning/30',
}

export function BillingClient({ plans, subscription }: Props) {
  const router = useRouter()
  const search = useSearchParams()
  const flash  = search.get('sub')

  const [busy, setBusy]   = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Auto-fire subscribe when user arrives with ?autosubscribe=<plan>
  // (e.g. from onboarding after picking a paid plan on the landing page).
  const autosubscribeFired = useRef(false)
  useEffect(() => {
    if (autosubscribeFired.current) return
    const raw = search.get('autosubscribe')
    if (!raw) return
    if (subscription && ['trialing', 'active', 'past_due'].includes(subscription.status)) return
    const target = plans.find((p) => p.name === raw && p.available)
    if (!target) return
    autosubscribeFired.current = true
    subscribe(target.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, subscription, plans])

  async function subscribe(plan: Plan['name']) {
    setBusy(`subscribe-${plan}`); setError(null)
    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Could not start subscription')
      window.location.href = json.authorization_url
    } catch (e: any) {
      setError(e.message); setBusy(null)
    }
  }

  async function cancel() {
    if (!confirm('Cancel subscription? Access continues until the current period ends.')) return
    setBusy('cancel'); setError(null)
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Cancel failed')
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  async function openManageLink() {
    setBusy('manage')
    try {
      const res = await fetch('/api/billing/manage-link')
      const json = await res.json()
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Could not get link')
      window.open(json.link, '_blank', 'noopener')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  const isLive = subscription && ['trialing', 'active', 'past_due'].includes(subscription.status)

  return (
    <div className="space-y-6">
      {/* Flash from callback */}
      {flash === 'success' && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">
          Payment confirmed. Your subscription is being activated — refresh in a moment.
        </div>
      )}
      {flash === 'failed' && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          The payment did not complete. Please try again.
        </div>
      )}

      {/* Current subscription */}
      {isLive && subscription && (
        <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-text-primary capitalize">
                  {subscription.plan_name} plan
                </h2>
                <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[subscription.status] ?? ''}`}>
                  {subscription.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-text-secondary">
                {(subscription.amount / 100).toLocaleString('en-GH', { style: 'currency', currency: subscription.currency })}
                {' '} / month
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={openManageLink}
                disabled={busy === 'manage'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-sunken disabled:opacity-50"
              >
                {busy === 'manage' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                Update card
              </button>
              <button
                onClick={cancel}
                disabled={busy === 'cancel'}
                className="inline-flex items-center rounded-lg border border-danger/30 px-3 py-1.5 text-sm text-danger hover:bg-danger/5 disabled:opacity-50"
              >
                {busy === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cancel'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {subscription.next_payment_at && (
              <div className="rounded-lg border border-border bg-surface-sunken p-3">
                <p className="text-xs text-text-tertiary">Next payment</p>
                <p className="mt-0.5 font-medium text-text-primary">
                  {new Date(subscription.next_payment_at).toLocaleDateString('en-GH', { dateStyle: 'medium' })}
                </p>
              </div>
            )}
            {subscription.current_period_end && (
              <div className="rounded-lg border border-border bg-surface-sunken p-3">
                <p className="text-xs text-text-tertiary">Period ends</p>
                <p className="mt-0.5 font-medium text-text-primary">
                  {new Date(subscription.current_period_end).toLocaleDateString('en-GH', { dateStyle: 'medium' })}
                </p>
              </div>
            )}
          </div>

          {subscription.status === 'past_due' && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              <p className="text-text-secondary">
                Your last payment failed. Update your card to keep access.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Plan grid — shown when no live subscription */}
      {!isLive && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p) => (
            <div
              key={p.name}
              className="rounded-xl border border-border bg-surface p-5 flex flex-col"
            >
              <h3 className="text-base font-semibold text-text-primary">{p.displayName}</h3>
              <p className="mt-1 text-xs text-text-secondary">{p.description}</p>
              <p className="mt-4 text-2xl font-bold text-text-primary">
                GH₵ {(p.amountPesewas / 100).toLocaleString()}
                <span className="text-sm font-normal text-text-secondary"> / mo</span>
              </p>

              <ul className="mt-4 space-y-1.5 text-xs text-text-secondary flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5">
                    <Check className="h-3.5 w-3.5 shrink-0 text-success mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => subscribe(p.name)}
                disabled={!p.available || busy === `subscribe-${p.name}`}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                title={!p.available ? 'Plan is not yet configured. Run admin bootstrap first.' : undefined}
              >
                {busy === `subscribe-${p.name}` && <Loader2 className="h-4 w-4 animate-spin" />}
                {p.available ? 'Subscribe' : 'Unavailable'}
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  )
}
