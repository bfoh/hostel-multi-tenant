'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, ChefHat, Package, XCircle } from 'lucide-react'

interface OrderItem { id: string; name_snapshot: string; quantity: number; subtotal_pesewas: number }
interface Order {
  id:               string
  order_ref:        string
  status:           string
  total_pesewas:    number
  payment_method:   string
  paid_at:          string | null
  customer_kind:    string
  table_label:      string | null
  placed_at:        string
  cancelled_reason: string | null
  notes:            string | null
  food_order_items: OrderItem[]
}

const STEPS = [
  { key: 'placed',    label: 'Placed',    Icon: Clock      },
  { key: 'preparing', label: 'Preparing', Icon: ChefHat    },
  { key: 'ready',     label: 'Ready',     Icon: Package    },
  { key: 'picked_up', label: 'Picked up', Icon: CheckCircle2 },
] as const

function ghs(pesewas: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(pesewas / 100)
}

const POLL_INTERVAL_MS = 4_000

export function PublicOrderTracker({ initial, slug, token, color }: {
  initial: Order
  slug:    string
  token:   string
  color:   string
}) {
  const [order, setOrder] = useState<Order>(initial)

  useEffect(() => {
    if (order.status === 'picked_up' || order.status === 'cancelled') return
    const id = setInterval(async () => {
      const res = await fetch(`/api/public/${slug}/food/orders/${order.id}?token=${encodeURIComponent(token)}`)
      if (!res.ok) return
      const next = await res.json() as Order
      setOrder(prev => ({ ...prev, ...next }))
    }, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [order.id, order.status, slug, token])

  const stepIndex = STEPS.findIndex(s => s.key === order.status)
  const cancelled = order.status === 'cancelled'
  const channelLabel = order.customer_kind === 'walk_in' ? 'Dine-in / pickup' : 'Online'

  return (
    <div className="space-y-3">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="font-mono text-lg font-bold">{order.order_ref}</p>
          <span className="font-mono text-base font-bold">{ghs(order.total_pesewas)}</span>
        </div>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {channelLabel}
          {order.table_label ? ` · Table ${order.table_label}` : ''}
          {' · '}
          {order.payment_method === 'online'
            ? (order.paid_at ? 'Paid online' : 'Awaiting payment')
            : 'Cash on pickup'}
        </p>
      </header>

      {cancelled ? (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <XCircle className="h-5 w-5 text-red-600" />
          <div>
            <p className="text-sm font-semibold text-red-800">Order cancelled</p>
            {order.cancelled_reason && <p className="text-xs text-red-600">{order.cancelled_reason}</p>}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <ol className="space-y-3">
            {STEPS.map((s, i) => {
              const reached = i <= stepIndex
              const active  = i === stepIndex
              return (
                <li key={s.key} className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${reached ? 'text-white' : 'bg-slate-100 text-slate-400'}`}
                    style={reached ? { backgroundColor: color } : undefined}
                  >
                    <s.Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className={`text-sm ${reached ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>{s.label}</p>
                    {active && <p className="text-[10px] text-slate-500">In progress…</p>}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Items</h2>
        <ul className="mt-2 space-y-1 text-sm">
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
      </section>

      <p className="text-center text-[11px] text-slate-400">Save this page or use the SMS link to come back later.</p>
    </div>
  )
}
