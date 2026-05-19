'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

interface CartLine { menu_item_id: string; quantity: number }
interface ItemLite {
  id: string; name: string; price_pesewas: number; photo_url: string | null
  is_sold_out: boolean; is_available?: boolean
}

interface Props {
  slug:           string
  color:          string
  onlineEnabled:  boolean
  items:          ItemLite[]                // today's menu (for line rendering)
  tables?:        string[]                  // restaurant table list from public_config
  pickupAllowed?: boolean                   // restaurant allows takeaway from same QR
}

type Mode = 'dine_in' | 'takeaway' | 'online'

const CART_KEY = (slug: string) => `food-cart:${slug}`

function ghs(pesewas: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(pesewas / 100)
}

export function GuestCheckoutForm({
  slug, color, onlineEnabled, items, tables = [], pickupAllowed = true,
}: Props) {
  const [cart, setCart]     = useState<CartLine[]>([])
  const [loaded, setLoaded] = useState(false)

  // Form state
  const [mode,    setMode]    = useState<Mode>('dine_in')
  const [first,   setFirst]   = useState('')
  const [last,    setLast]    = useState('')
  const [phone,   setPhone]   = useState('')
  const [email,   setEmail]   = useState('')
  const [tableLabel, setTableLabel] = useState('')
  const [notes,   setNotes]   = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cash_on_pickup'>('cash_on_pickup')

  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY(slug))
      if (raw) setCart(JSON.parse(raw) as CartLine[])
    } catch {}
    setLoaded(true)
  }, [slug])

  // Online channel always pays online
  useEffect(() => {
    if (mode === 'online') setPaymentMethod('online')
  }, [mode])

  // Channel sent to API: dine_in + takeaway both = walk_in
  const channel: 'walk_in' | 'online' = mode === 'online' ? 'online' : 'walk_in'

  const lines = cart.map(c => {
    const it = items.find(i => i.id === c.menu_item_id)
    if (!it) return null
    return {
      ...c,
      name:           it.name,
      photo_url:      it.photo_url,
      price_pesewas:  it.price_pesewas,
      subtotal:       it.price_pesewas * c.quantity,
      available:      !it.is_sold_out,
    }
  }).filter(Boolean) as Array<NonNullable<ReturnType<typeof Object>>>

  const total = lines
    .filter((l: any) => l.available)
    .reduce((s, l: any) => s + l.subtotal, 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!first.trim() || !last.trim() || !phone.trim()) {
      setErr('Name and phone are required'); return
    }
    if (cart.length === 0 || total === 0) {
      setErr('Cart is empty'); return
    }
    if (mode === 'dine_in' && tables.length > 0 && !tableLabel.trim()) {
      setErr('Pick a table to dine in.'); return
    }
    setErr(null); setBusy(true)
    const tableForSubmit =
      mode === 'dine_in'
        ? (tableLabel.trim() || null)
        : mode === 'takeaway'
        ? 'Takeaway'
        : null
    const res = await fetch(`/api/public/${slug}/food/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel,
        first_name:     first.trim(),
        last_name:      last.trim(),
        phone:          phone.trim(),
        email:          email.trim() || null,
        items:          cart,
        payment_method: paymentMethod,
        notes:          notes.trim() || null,
        table_label:    tableForSubmit,
      }),
    })
    setBusy(false)
    if (!res.ok) {
      const j = await res.json().catch(() => null) as any
      setErr(j?.error ?? 'Order failed')
      return
    }
    const j = await res.json()
    // Clear cart locally
    try { localStorage.removeItem(CART_KEY(slug)) } catch {}
    if (j.authorization_url) {
      window.location.href = j.authorization_url
    } else {
      window.location.href = `/order/${slug}/orders/${j.id}?token=${j.tracking_token}`
    }
  }

  if (!loaded) return null

  if (cart.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-500">Your cart is empty</p>
        <a href={`/order/${slug}`} className="mt-2 inline-block text-xs underline" style={{ color }}>Back to menu</a>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Cart summary */}
      <section className="space-y-2">
        {lines.map((l: any) => (
          <div key={l.menu_item_id} className={`flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 ${!l.available ? 'opacity-60' : ''}`}>
            {l.photo_url
              ? <img src={l.photo_url} alt="" className="h-14 w-14 rounded-lg object-cover" />
              : <div className="h-14 w-14 rounded-lg bg-slate-100" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{l.name}</p>
              <p className="text-xs text-slate-500">×{l.quantity} · {ghs(l.price_pesewas)} ea</p>
              {!l.available && <p className="mt-0.5 text-[10px] text-red-600">Sold out — will be removed</p>}
            </div>
            <p className="font-mono text-sm font-bold">{ghs(l.subtotal)}</p>
          </div>
        ))}
      </section>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between text-base font-bold">
          <span>Total</span>
          <span className="font-mono">{ghs(total)}</span>
        </div>
      </div>

      {/* Order mode */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">Order type</h2>

        <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer">
          <input type="radio" checked={mode === 'dine_in'} onChange={() => setMode('dine_in')} className="mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium">Dine in</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {tables.length > 0 ? 'Pick your table below.' : 'Eat at the restaurant.'}
            </p>
          </div>
        </label>

        {pickupAllowed && (
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer">
            <input type="radio" checked={mode === 'takeaway'} onChange={() => setMode('takeaway')} className="mt-0.5" />
            <div>
              <p className="text-sm font-medium">Takeaway</p>
              <p className="mt-0.5 text-xs text-slate-500">Pack it up — pick up at the counter.</p>
            </div>
          </label>
        )}

        <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer">
          <input type="radio" checked={mode === 'online'} onChange={() => setMode('online')} className="mt-0.5" />
          <div>
            <p className="text-sm font-medium">Order ahead (pay online)</p>
            <p className="mt-0.5 text-xs text-slate-500">Pay online and pick up later. No on-site cash.</p>
          </div>
        </label>

        {mode === 'dine_in' && tables.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-xs font-medium text-slate-600">Your table</p>
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
              {tables.map((t) => {
                const active = t === tableLabel
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTableLabel(t)}
                    className={`rounded-lg border px-2 py-2 text-center text-xs font-semibold transition-colors ${
                      active ? 'border-transparent text-white' : 'border-slate-200 text-slate-700 hover:border-slate-400'
                    }`}
                    style={active ? { backgroundColor: color } : undefined}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {mode === 'dine_in' && tables.length === 0 && (
          <input
            value={tableLabel}
            onChange={(e) => setTableLabel(e.target.value)}
            maxLength={40}
            placeholder="Table or seat (optional, e.g. T5)"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        )}
      </section>

      {/* Contact */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">Your contact</h2>
        <div className="grid grid-cols-2 gap-2">
          <input value={first} onChange={e => setFirst(e.target.value)} required maxLength={80}
            placeholder="First name" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <input value={last} onChange={e => setLast(e.target.value)} required maxLength={80}
            placeholder="Last name" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <input value={phone} onChange={e => setPhone(e.target.value)} required maxLength={30}
          placeholder="Phone (e.g. 0244000000)" inputMode="tel"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        <input value={email} onChange={e => setEmail(e.target.value)} maxLength={200}
          placeholder="Email (optional)" type="email"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        <textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={280} rows={2}
          placeholder="Note for kitchen (optional)"
          className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </section>

      {/* Payment */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">Payment</h2>
        {channel === 'walk_in' && (
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer">
            <input type="radio" checked={paymentMethod === 'cash_on_pickup'} onChange={() => setPaymentMethod('cash_on_pickup')} className="mt-0.5" />
            <div>
              <p className="text-sm font-medium">Pay on pickup (cash)</p>
              <p className="mt-0.5 text-xs text-slate-500">Pay at the counter when you collect.</p>
            </div>
          </label>
        )}
        {onlineEnabled ? (
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer">
            <input type="radio" checked={paymentMethod === 'online'} onChange={() => setPaymentMethod('online')} className="mt-0.5" />
            <div>
              <p className="text-sm font-medium">Pay online</p>
              <p className="mt-0.5 text-xs text-slate-500">MoMo, card, or bank — via Paystack.</p>
            </div>
          </label>
        ) : (
          mode === 'online' && (
            <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This restaurant has not enabled online payment. Choose Dine-in or Takeaway.
            </p>
          )
        )}
      </section>

      {err && <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}

      <button type="submit" disabled={busy || total === 0}
        className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white disabled:opacity-50"
        style={{ backgroundColor: color }}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {paymentMethod === 'online' ? 'Pay & place order' : 'Place order'}
      </button>
    </form>
  )
}
