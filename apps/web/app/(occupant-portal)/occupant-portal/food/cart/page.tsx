import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCart } from '@/lib/food/cart'
import { PaymentMethodPicker } from '@/components/occupant-portal/food/payment-method-picker'

export const metadata: Metadata = { title: 'Cart · Food' }

function ghs(pesewas: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(pesewas / 100)
}

export default async function CartPage() {
  const session = await getOccupantSession()
  if (!session) redirect('/login')

  const cart = await getCart(session.occupantId)
  if (cart.length === 0) {
    return (
      <div className="space-y-3">
        <Link href="/occupant-portal/food" className="inline-flex items-center gap-1 text-xs text-slate-500">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to menu
        </Link>
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-500">Your cart is empty</p>
        </div>
      </div>
    )
  }

  const admin = createAdminClient() as any
  const { data: items } = await admin
    .from('menu_items')
    .select('id, name, price_pesewas, photo_url, is_available, is_sold_out, publish_date')
    .in('id', cart.map(c => c.menu_item_id))
    .eq('tenant_id', session.tenantId)
  const today = new Date().toISOString().slice(0, 10)
  const byId  = new Map<string, any>(((items ?? []) as any[]).map(i => [i.id, i]))

  const lines = cart.map(c => {
    const it = byId.get(c.menu_item_id)
    if (!it) return { ...c, name: 'Unavailable item', photo_url: null, price_pesewas: 0, available: false }
    const available = it.is_available && !it.is_sold_out && (!it.publish_date || it.publish_date === today)
    return {
      menu_item_id: c.menu_item_id,
      quantity:     c.quantity,
      name:         it.name,
      photo_url:    it.photo_url,
      price_pesewas: it.price_pesewas,
      available,
    }
  })
  const total = lines.filter(l => l.available).reduce((s, l) => s + l.price_pesewas * l.quantity, 0)

  const { data: tenantRow } = await admin
    .from('tenants')
    .select('paystack_subaccount_code')
    .eq('id', session.tenantId)
    .maybeSingle()
  const onlineEnabled = !!tenantRow?.paystack_subaccount_code

  return (
    <div className="space-y-3">
      <Link href="/occupant-portal/food" className="inline-flex items-center gap-1 text-xs text-slate-500">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to menu
      </Link>
      <header>
        <h1 className="text-xl font-bold text-slate-900">Your cart</h1>
      </header>

      <section className="space-y-2">
        {lines.map(l => (
          <div key={l.menu_item_id} className={`flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 ${!l.available ? 'opacity-60' : ''}`}>
            {l.photo_url
              ? <img src={l.photo_url} alt="" className="h-14 w-14 rounded-lg object-cover" />
              : <div className="h-14 w-14 rounded-lg bg-slate-100" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{l.name}</p>
              <p className="text-xs text-slate-500">×{l.quantity} · {ghs(l.price_pesewas)} ea</p>
              {!l.available && <p className="mt-0.5 text-[10px] text-red-600">No longer available</p>}
            </div>
            <p className="font-mono text-sm font-bold">{ghs(l.price_pesewas * l.quantity)}</p>
          </div>
        ))}
      </section>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between text-base font-bold">
          <span>Total</span>
          <span className="font-mono">{ghs(total)}</span>
        </div>
      </div>

      <PaymentMethodPicker color={session.tenantColor} total={total} onlineEnabled={onlineEnabled} />
    </div>
  )
}
