'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, CheckCircle2, Clock, Loader2, Plus, AlertCircle, Minus } from 'lucide-react'
import { formatGHS } from '@/lib/utils'

interface Installment {
  id: string
  plan_id: string
  installment_number: number
  amount: number
  due_date: string
  status: 'pending' | 'paid' | 'overdue' | 'waived'
  paid_at: string | null
  payment_method: string | null
  reference: string | null
}

interface Plan {
  id: string
  name: string
  total_amount: number
  installments_count: number
  payment_plan_installments: Installment[]
}

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  icon: Clock,         color: 'text-text-secondary',  bg: 'bg-surface-raised' },
  paid:     { label: 'Paid',     icon: CheckCircle2,  color: 'text-success',         bg: 'bg-success/10' },
  overdue:  { label: 'Overdue',  icon: AlertCircle,   color: 'text-danger',          bg: 'bg-danger/10' },
  waived:   { label: 'Waived',   icon: Minus,         color: 'text-text-tertiary',   bg: 'bg-surface-sunken' },
}

const PAYMENT_METHODS = [
  { value: 'cash',            label: 'Cash' },
  { value: 'momo_mtn',        label: 'MTN MoMo' },
  { value: 'momo_vodafone',   label: 'Vodafone Cash' },
  { value: 'momo_airteltigo', label: 'AirtelTigo Money' },
  { value: 'bank_transfer',   label: 'Bank Transfer' },
  { value: 'card',            label: 'Card' },
]

export function PaymentPlanCard({
  bookingId,
  balance,
  initialPlan,
}: {
  bookingId: string
  balance: number
  initialPlan: Plan | null
}) {
  const router = useRouter()
  const [plan, setPlan]           = useState<Plan | null>(initialPlan)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating]   = useState(false)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)

  // Create form state
  const [count, setCount]       = useState(3)
  const [interval, setInterval] = useState(30)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [method, setMethod]     = useState('cash')
  const [ref, setRef]           = useState('')

  async function createPlan() {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installments_count: count, interval_days: interval, start_date: startDate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create plan')
      setShowCreate(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setCreating(false)
    }
  }

  async function markInstallment(installmentId: string, planId: string, newStatus: string) {
    setMarkingId(installmentId)
    setError(null)
    try {
      const res = await fetch(`/api/plans/${planId}/installments/${installmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          payment_method: newStatus === 'paid' ? method : undefined,
          reference: newStatus === 'paid' ? ref : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setMarkingId(null)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  if (!plan) {
    return (
      <div>
        {!showCreate ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CalendarClock className="h-8 w-8 text-text-disabled" />
            <div>
              <p className="text-sm font-medium text-text-primary">No payment plan</p>
              <p className="text-xs text-text-tertiary mt-0.5">
                Split the outstanding balance into scheduled installments
              </p>
            </div>
            {balance > 0 && (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Create plan
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium text-text-primary">
              Balance to split: <span className="text-danger font-semibold">{formatGHS(balance)}</span>
            </p>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Installments</label>
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  {[2,3,4,5,6,8,10,12].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Every (days)</label>
                <select
                  value={interval}
                  onChange={(e) => setInterval(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value={7}>7 (weekly)</option>
                  <option value={14}>14 (fortnightly)</option>
                  <option value={30}>30 (monthly)</option>
                  <option value={60}>60 (bimonthly)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">First due</label>
                <input
                  type="date"
                  value={startDate}
                  min={today}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
            </div>

            <div className="rounded-lg bg-surface-raised p-3 text-xs text-text-secondary">
              Each installment: <strong className="text-text-primary">{formatGHS(balance / count)}</strong>
              {' '}· {count} payments spaced {interval} days apart
            </div>

            {error && <p className="text-xs text-danger">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={createPlan}
                disabled={creating}
                className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-50 transition-colors"
              >
                {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {creating ? 'Creating…' : 'Create plan'}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const installments = [...(plan.payment_plan_installments ?? [])].sort(
    (a, b) => a.installment_number - b.installment_number
  )
  const paid  = installments.filter((i) => i.status === 'paid').length
  const total = installments.length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-text-primary">{plan.name}</p>
          <p className="text-xs text-text-tertiary">{paid}/{total} installments paid</p>
        </div>
        <div className="h-1.5 w-24 rounded-full bg-surface-sunken overflow-hidden">
          <div
            className="h-full bg-success rounded-full transition-all"
            style={{ width: `${total > 0 ? (paid / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Quick mark method/ref */}
      <div className="grid grid-cols-2 gap-2">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand"
        >
          {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="Reference (optional)"
          className="rounded-lg border border-border bg-surface px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="divide-y divide-border">
        {installments.map((ins) => {
          const cfg  = STATUS_CONFIG[ins.status]
          const Icon = cfg.icon
          const isOverdue = ins.status === 'pending' && ins.due_date < today
          const actualStatus = isOverdue ? 'overdue' : ins.status
          const actualCfg = STATUS_CONFIG[actualStatus]
          const ActualIcon = actualCfg.icon
          const loading = markingId === ins.id

          return (
            <div key={ins.id} className="flex items-center gap-3 py-2.5">
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${actualCfg.bg}`}>
                <ActualIcon className={`h-3.5 w-3.5 ${actualCfg.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">
                  #{ins.installment_number} · {formatGHS(ins.amount)}
                </p>
                <p className={`text-xs ${isOverdue ? 'text-danger font-medium' : 'text-text-tertiary'}`}>
                  Due: {ins.due_date}
                  {ins.paid_at && ` · Paid ${ins.paid_at.slice(0, 10)}`}
                  {ins.payment_method && ` · ${ins.payment_method.replace(/_/g, ' ')}`}
                </p>
              </div>
              {ins.status !== 'paid' && ins.status !== 'waived' && (
                <div className="flex gap-1 shrink-0">
                  <button
                    disabled={loading}
                    onClick={() => markInstallment(ins.id, plan.id, 'paid')}
                    className="rounded px-2 py-0.5 text-xs bg-success/10 text-success hover:bg-success/20 disabled:opacity-50 transition-colors"
                  >
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Mark paid'}
                  </button>
                  <button
                    disabled={loading}
                    onClick={() => markInstallment(ins.id, plan.id, 'waived')}
                    className="rounded px-2 py-0.5 text-xs text-text-tertiary hover:text-text-primary hover:bg-surface-raised disabled:opacity-50 transition-colors"
                  >
                    Waive
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
