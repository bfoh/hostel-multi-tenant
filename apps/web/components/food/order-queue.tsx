'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { OrderCard } from './order-card'
import { Search } from 'lucide-react'

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
  occupant_id:      string
  occupant?:        { first_name: string; last_name: string; phone: string | null } | null
  food_order_items: OrderItem[]
  customer_kind?:   'walk_in' | 'online' | null
  table_label?:     string | null
  channel?:         'walk_in' | 'online' | null
}

const COLUMNS: { key: string; label: string }[] = [
  { key: 'placed',    label: 'Placed'    },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready',     label: 'Ready'     },
]

export function OrderQueue({ tenantId, initialOrders }: { tenantId: string; initialOrders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const sb = createClient()
    const ch = sb.channel(`food-orders:tenant:${tenantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'food_orders', filter: `tenant_id=eq.${tenantId}` },
        async (payload) => {
          const row = (payload.new ?? payload.old) as any
          if (!row?.id) return
          // Refetch the row with items + occupant join — payload.new doesn't include those
          const sbAny = sb as any
          const { data: full } = await sbAny
            .from('food_orders')
            .select('*, food_order_items(*), occupant:occupants(first_name, last_name, phone)')
            .eq('id', row.id)
            .maybeSingle()
          setOrders(prev => {
            if (!full) return prev.filter(o => o.id !== row.id)
            const without = prev.filter(o => o.id !== full.id)
            return [...without, full as Order]
          })
        },
      )
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [tenantId])

  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const visible = orders.filter((order) => {
    if (!COLUMNS.some((column) => column.key === order.status)) return false
    if (terms.length === 0) return true
    const haystack = [
      order.order_ref,
      order.payment_method,
      order.notes,
      order.table_label,
      order.occupant?.first_name,
      order.occupant?.last_name,
      order.occupant?.phone,
      ...order.food_order_items.map((item) => item.name_snapshot),
    ].filter(Boolean).join(' ').toLowerCase()
    return terms.every((term) => haystack.includes(term))
  })

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="text-text-disabled pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search order, occupant, phone, table, or item…"
          className="border-border bg-surface w-full rounded-lg border py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {COLUMNS.map(col => {
        const colOrders = visible
          .filter(o => o.status === col.key)
          .sort((a, b) => a.placed_at.localeCompare(b.placed_at))
        return (
          <section key={col.key} className="rounded-xl border border-border bg-surface-sunken p-3">
            <header className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold text-text-primary">{col.label}</h2>
              <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                {colOrders.length}
              </span>
            </header>
            <div className="space-y-2">
              {colOrders.length === 0
                ? <p className="rounded-lg border border-dashed border-border p-4 text-center text-[11px] text-text-tertiary">No orders</p>
                : colOrders.map(o => <OrderCard key={o.id} order={o} />)}
            </div>
          </section>
        )
        })}
      </div>
    </div>
  )
}
