'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Minus, ShoppingCart, Loader2, CheckCircle, Trash2, Link2, Copy, X } from 'lucide-react'
import type { RevenuePointItem } from '@/lib/data/revenue-points'

const PAYMENT_METHODS = [
  { value: 'cash',            label: 'Cash' },
  { value: 'momo_mtn',       label: 'MTN MoMo (offline)' },
  { value: 'momo_vodafone',  label: 'Vodafone Cash (offline)' },
  { value: 'momo_airteltigo', label: 'AirtelTigo (offline)' },
  { value: 'card',            label: 'Card (offline)' },
  { value: 'on_account',      label: 'Charge to Room' },
]

const ONLINE_METHODS = [
  { value: 'mobile_money',  label: 'Online — Mobile Money' },
  { value: 'card',          label: 'Online — Card' },
  { value: 'bank_transfer', label: 'Online — Bank Transfer' },
]

interface CartItem {
  itemId: string
  name:   string
  unitPrice: number
  quantity: number
}

export function POSClient({
  revenuePointId,
  items,
  paystackEnabled = false,
}: {
  revenuePointId: string
  items: RevenuePointItem[]
  paystackEnabled?: boolean
}) {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [method, setMethod] = useState('cash')
  const [customerName, setCustomerName] = useState('')
  const [customItemName, setCustomItemName] = useState('')
  const [customItemPrice, setCustomItemPrice] = useState('')
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(false)

  // Online checkout modal state
  const [online, setOnline] = useState<{
    url:         string
    reference:   string
    amount:      number
    status:      'pending' | 'completed' | 'failed'
  } | null>(null)
  const [copied, setCopied] = useState(false)

  // Poll for completion when online checkout is active
  useEffect(() => {
    if (!online || online.status !== 'pending') return
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/revenue-points/sales/by-reference?reference=${encodeURIComponent(online.reference)}`)
        const data = await res.json()
        if (data.status === 'completed') {
          setOnline((cur) => (cur ? { ...cur, status: 'completed' } : cur))
          setCart([])
          setCustomerName('')
          router.refresh()
        }
      } catch { /* keep polling */ }
    }, 4000)
    return () => clearInterval(id)
  }, [online, router])

  const total = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0)

  function addToCart(item: RevenuePointItem) {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.itemId === item.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 }
        return next
      }
      return [...prev, { itemId: item.id, name: item.name, unitPrice: item.unit_price, quantity: 1 }]
    })
  }

  function updateQuantity(itemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => (c.itemId === itemId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c))
        .filter((c) => c.quantity > 0)
    )
  }

  function addCustomItem() {
    if (!customItemName || !customItemPrice) return
    const price = Math.round(parseFloat(customItemPrice) * 100)
    if (isNaN(price) || price <= 0) return
    const id = `custom-${Date.now()}`
    setCart((prev) => [...prev, { itemId: id, name: customItemName, unitPrice: price, quantity: 1 }])
    setCustomItemName('')
    setCustomItemPrice('')
  }

  const isOnline = method === 'mobile_money' || method === 'bank_transfer' || method === 'online_card'

  async function handleCheckout() {
    if (cart.length === 0) return
    setBusy(true)
    setSuccess(false)

    try {
      if (isOnline) {
        // Single Paystack transaction for the full cart
        const description = cart.length === 1
          ? `${cart[0].name} × ${cart[0].quantity}`
          : `POS sale · ${cart.reduce((s, c) => s + c.quantity, 0)} items`

        const res = await fetch('/api/revenue-points/sales/pay-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            revenue_point_id: revenuePointId,
            item_id:          cart.length === 1 && !cart[0].itemId.startsWith('custom-') ? cart[0].itemId : null,
            description,
            quantity:         1,
            unit_price:       total,
            total_amount:     total,
            payment_method:   method === 'online_card' ? 'card' : method,
            customer_name:    customerName || undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed')
        setOnline({
          url:       data.authorization_url,
          reference: data.reference,
          amount:    data.amount,
          status:    'pending',
        })
      } else {
        for (const item of cart) {
          await fetch('/api/revenue-points/sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              revenue_point_id: revenuePointId,
              item_id:          item.itemId.startsWith('custom-') ? null : item.itemId,
              description:      item.name,
              quantity:         item.quantity,
              unit_price:       item.unitPrice,
              total_amount:     item.unitPrice * item.quantity,
              payment_method:   method,
              customer_name:    customerName || undefined,
            }),
          })
        }
        setSuccess(true)
        setCart([])
        setCustomerName('')
        setTimeout(() => setSuccess(false), 3000)
        router.refresh()
      }
    } catch {
      // Silently handle
    } finally {
      setBusy(false)
    }
  }

  async function copyOnlineUrl() {
    if (!online) return
    try {
      await navigator.clipboard.writeText(online.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard unavailable */ }
  }

  // Group items by category
  const categories = new Map<string, RevenuePointItem[]>()
  for (const item of items) {
    const cat = item.category ?? 'General'
    if (!categories.has(cat)) categories.set(cat, [])
    categories.get(cat)!.push(item)
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left: Items grid */}
      <div className="lg:col-span-2 space-y-4">
        {items.length > 0 ? (
          Array.from(categories.entries()).map(([category, catItems]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-2">{category}</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {catItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="rounded-lg border border-border bg-surface p-3 text-left transition-all hover:border-brand/30 hover:shadow-sm active:scale-95"
                  >
                    <p className="text-sm font-medium text-text-primary truncate">{item.name}</p>
                    <p className="mt-1 text-xs font-mono text-text-secondary">
                      GH₵ {(item.unit_price / 100).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-text-disabled">per {item.unit}</p>
                  </button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-text-secondary">No items configured yet.</p>
            <p className="text-xs text-text-tertiary mt-1">Use the custom item form below to record sales.</p>
          </div>
        )}

        {/* Custom item */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-3">Custom Item</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={customItemName}
              onChange={(e) => setCustomItemName(e.target.value)}
              placeholder="Item name"
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-primary placeholder:text-text-disabled focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <input
              type="number"
              step="0.01"
              value={customItemPrice}
              onChange={(e) => setCustomItemPrice(e.target.value)}
              placeholder="GH₵"
              className="w-24 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-primary placeholder:text-text-disabled focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <button
              onClick={addCustomItem}
              disabled={!customItemName || !customItemPrice}
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Right: Cart */}
      <div className="space-y-4">
        <div className="sticky top-4 rounded-xl border border-border bg-surface p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-text-secondary" />
            <h2 className="font-semibold text-text-primary">Cart ({cart.length})</h2>
          </div>

          {cart.length === 0 ? (
            <p className="text-sm text-text-tertiary py-4 text-center">Tap items to add</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {cart.map((c) => (
                <div key={c.itemId} className="flex items-center justify-between rounded-lg bg-surface-sunken p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{c.name}</p>
                    <p className="text-xs font-mono text-text-secondary">
                      GH₵ {(c.unitPrice / 100).toFixed(2)} × {c.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => updateQuantity(c.itemId, -1)}
                      className="rounded p-1 hover:bg-danger/10 text-text-secondary hover:text-danger"
                    >
                      {c.quantity === 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                    </button>
                    <span className="w-6 text-center text-sm font-medium text-text-primary">{c.quantity}</span>
                    <button
                      onClick={() => updateQuantity(c.itemId, 1)}
                      className="rounded p-1 hover:bg-brand/10 text-text-secondary hover:text-brand"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Total */}
          <div className="border-t border-border pt-3 flex justify-between items-center">
            <span className="font-semibold text-text-primary">Total</span>
            <span className="font-mono text-xl font-bold text-text-primary">
              GH₵ {(total / 100).toFixed(2)}
            </span>
          </div>

          {/* Payment method */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Payment Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand focus:ring-1 focus:ring-brand"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
              {paystackEnabled && (
                <optgroup label="Pay online (Paystack)">
                  <option value="mobile_money">{ONLINE_METHODS[0].label}</option>
                  <option value="online_card">{ONLINE_METHODS[1].label}</option>
                  <option value="bank_transfer">{ONLINE_METHODS[2].label}</option>
                </optgroup>
              )}
            </select>
          </div>

          {/* Customer name */}
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Customer name (optional)"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-brand focus:ring-1 focus:ring-brand"
          />

          {/* Checkout */}
          <button
            onClick={handleCheckout}
            disabled={busy || cart.length === 0}
            className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : success ? (
              <CheckCircle className="h-4 w-4" />
            ) : isOnline ? (
              <Link2 className="h-4 w-4" />
            ) : null}
            {success ? 'Sale Recorded!' : isOnline ? `Generate pay link · GH₵ ${(total / 100).toFixed(2)}` : `Charge GH₵ ${(total / 100).toFixed(2)}`}
          </button>
        </div>
      </div>

      {/* ── Online checkout modal ─────────────────────────────────────── */}
      {online && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-text-primary">
                  {online.status === 'completed' ? 'Payment received' : 'Waiting for payment'}
                </h3>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  GH₵ {(online.amount / 100).toFixed(2)} · {online.reference}
                </p>
              </div>
              <button
                onClick={() => setOnline(null)}
                className="rounded p-1 text-text-tertiary hover:bg-surface-raised"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {online.status === 'pending' && (
              <div className="mt-4 space-y-4">
                <p className="text-sm text-text-secondary">
                  Share this link with the customer. They can scan the QR or open it on their phone to pay with Mobile Money, Card or Bank Transfer.
                </p>

                {/* QR code via public service — no external dep */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(online.url)}`}
                  alt="Payment QR code"
                  className="mx-auto h-56 w-56 rounded-lg border border-border bg-white p-2"
                />

                <div className="flex gap-2">
                  <input
                    readOnly
                    value={online.url}
                    className="flex-1 rounded-md border border-border bg-surface-raised px-2 py-1.5 text-[11px] font-mono"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button
                    onClick={copyOnlineUrl}
                    className="flex items-center gap-1 rounded-md border border-border bg-surface-raised px-2 py-1.5 text-xs font-medium"
                  >
                    <Copy className="h-3 w-3" />
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div className="flex items-center justify-center gap-2 text-xs text-text-tertiary">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Waiting for confirmation…
                </div>
              </div>
            )}

            {online.status === 'completed' && (
              <div className="mt-6 flex flex-col items-center gap-3 py-2 text-center">
                <CheckCircle className="h-10 w-10 text-success" />
                <p className="font-semibold text-success">Sale recorded</p>
                <p className="text-xs text-text-secondary">Receipt has been logged. You can close this window.</p>
                <button
                  onClick={() => setOnline(null)}
                  className="mt-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
