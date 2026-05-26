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

  const cart = await getCart(session.occupantId, session.tenantId)
  if (cart.length === 0) {
    return (
      <div className="space-y-3">
        <Link href="/occupant-portal/food" className="inline-flex items-center gap-1 text-xs text-slate-500">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to menu
        </Link>
        <div className="flex flex-col items-center rounded-2xl border border-slate-200/70 bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_28px_-18px_rgba(16,24,40,0.20)]">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-100">
            <ArrowLeft className="h-7 w-7 text-slate-300" />
          </span>
          <p className="mt-3 text-[14px] font-semibold text-slate-700">Your cart is empty</p>
          <p className="mt-0.5 text-[12.5px] text-slate-400">Add items from the menu to get started.</p>
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
      <h1 className="text-[18px] font-bold tracking-tight text-slate-900">Your cart</h1>

      <section className="space-y-2">
        {lines.map(l => (
          <div key={l.menu_item_id} className={`flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_28px_-20px_rgba(16,24,40,0.18)] ${!l.available ? 'opacity-60' : ''}`}>
            {l.photo_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={l.photo_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
              : <div className="h-14 w-14 rounded-xl bg-slate-100" />}
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-slate-900">{l.name}</p>
              <p className="text-[12px] text-slate-500">×{l.quantity} · {ghs(l.price_pesewas)} ea</p>
              {!l.available && <p className="mt-0.5 text-[10px] font-medium text-red-600">No longer available</p>}
            </div>
            <p className="font-mono text-[14px] font-bold text-slate-900">{ghs(l.price_pesewas * l.quantity)}</p>
          </div>
        ))}
      </section>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_28px_-18px_rgba(16,24,40,0.20)]">
        <div className="flex items-center justify-between text-[16px] font-bold text-slate-900">
          <span>Total</span>
          <span className="font-mono">{ghs(total)}</span>
        </div>
      </div>

      <PaymentMethodPicker color={session.tenantColor} total={total} onlineEnabled={onlineEnabled} />
    </div>
  )
}
