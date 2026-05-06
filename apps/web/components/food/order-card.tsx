'use client'

import { useState } from 'react'
import { Loader2, ChevronRight, X } from 'lucide-react'

interface OrderItem { id: string; name_snapshot: string; quantity: number; subtotal_pesewas: number }
interface Order {
  id:               string
  order_ref:        string
  status:           string
  total_pesewas:    number
  payment_method:   string
  paid_at:          string | null
  placed_at:        string
  notes:            string | null
  occupant?:        { first_name: string; last_name: string; phone: string | null } | null
  food_order_items: OrderItem[]
}

const NEXT_STATUS: Record<string, string | null> = {
  placed:    'preparing',
  preparing: 'ready',
  ready:     'picked_up',
}

const ACTION_LABEL: Record<string, string> = {
  preparing: 'Start preparing',
  ready:     'Mark ready',
  picked_up: 'Mark picked up',
}

function ghs(pesewas: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(pesewas / 100)
}

function timeOf(iso: string) {
  return new Intl.DateTimeFormat('en-GH', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

export function OrderCard({ order }: { order: Order }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [err,  setErr]  = useState<string | null>(null)

  const next = NEXT_STATUS[order.status]
  const occName = order.occupant
    ? `${order.occupant.first_name} ${order.occupant.last_name}`.trim()
    : '—'

  async function move(to: string, reason?: string) {
    setBusy(to); setErr(null)
    const res = await fetch(`/api/food-orders/${order.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: to, reason }),
    })
    setBusy(null)
    if (!res.ok) {
      const j = await res.json().catch(() => null) as any
      setErr(j?.error ?? 'Failed')
    }
  }

  async function cancel() {
    const reason = prompt('Reason for cancellation (will be sent to resident):') ?? undefined
    if (reason === undefined) return
    move('cancelled', reason || 'cancelled by kitchen')
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-sm font-bold">{order.order_ref}</p>
          <p className="text-[11px] text-text-secondary">
            {timeOf(order.placed_at)} · {occName}
          </p>
          <p className="text-[10px] text-text-tertiary">
            {order.payment_method === 'online'
              ? (order.paid_at ? 'Paid online' : 'Online — awaiting payment')
              : 'Cash on pickup'}
          </p>
        </div>
        <span className="font-mono text-sm font-semibold">{ghs(order.total_pesewas)}</span>
      </div>

      <ul className="mt-2 space-y-0.5 border-t border-border pt-2 text-xs">
        {order.food_order_items.map(it => (
          <li key={it.id} className="flex justify-between">
            <span>×{it.quantity} {it.name_snapshot}</span>
            <span className="font-mono">{ghs(it.subtotal_pesewas)}</span>
          </li>
        ))}
      </ul>

      {order.notes && (
        <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">Note: {order.notes}</p>
      )}

      {err && <p className="mt-1 text-[11px] text-danger">{err}</p>}

      <div className="mt-2 flex items-center gap-2">
        {next && (
          <button onClick={() => move(next)} disabled={!!busy}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-fg disabled:opacity-50">
            {busy === next ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {ACTION_LABEL[next]}
          </button>
        )}
        {order.status !== 'picked_up' && order.status !== 'cancelled' && (
          <button onClick={cancel} disabled={!!busy}
            className="rounded-lg border border-border px-2 py-1.5 text-xs text-text-secondary hover:bg-surface-raised">
            {busy === 'cancelled' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </div>
  )
}
