'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { MenuItemCard } from './menu-item-card'

interface Category { id: string; name: string; sort_order: number }
interface Item {
  id:            string
  category_id:   string | null
  name:          string
  description:   string | null
  price_pesewas: number
  photo_url:     string | null
  is_sold_out:   boolean
  sort_order:    number
}
interface CartLine { menu_item_id: string; quantity: number }

function ghs(pesewas: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(pesewas / 100)
}

export function MenuGrid({ categories, items, color }: { categories: Category[]; items: Item[]; color: string }) {
  const [cart, setCart] = useState<CartLine[]>([])

  useEffect(() => {
    fetch('/api/occupant/food/cart')
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (j?.items) {
          setCart(j.items.map((l: any) => ({ menu_item_id: l.menu_item_id, quantity: l.quantity })))
        }
      })
      .catch(() => {})
  }, [])

  const qtyOf = (id: string) => cart.find(c => c.menu_item_id === id)?.quantity ?? 0

  const updateQty = async (id: string, qty: number) => {
    const next = qty === 0
      ? cart.filter(c => c.menu_item_id !== id)
      : cart.find(c => c.menu_item_id === id)
        ? cart.map(c => c.menu_item_id === id ? { ...c, quantity: qty } : c)
        : [...cart, { menu_item_id: id, quantity: qty }]
    setCart(next)
    await fetch('/api/occupant/food/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: next }),
    })
  }

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, c) => {
      const it = items.find(i => i.id === c.menu_item_id)
      return sum + (it?.price_pesewas ?? 0) * c.quantity
    }, 0)
  }, [cart, items])

  const cartCount = cart.reduce((n, c) => n + c.quantity, 0)

  // Group items by category, plus an "Other" bucket for category-less items
  const itemsByCat = new Map<string | 'other', Item[]>()
  for (const it of items) {
    const k = it.category_id ?? 'other'
    if (!itemsByCat.has(k)) itemsByCat.set(k, [])
    itemsByCat.get(k)!.push(it)
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-slate-200/70 bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_28px_-18px_rgba(16,24,40,0.20)]">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-100">
          <ShoppingCart className="h-7 w-7 text-slate-300" />
        </span>
        <p className="mt-3 text-[14px] font-semibold text-slate-700">No items on today&apos;s menu</p>
        <p className="mt-0.5 text-[12.5px] text-slate-400">Check back later.</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6 pb-24">
        {categories.map(cat => {
          const catItems = itemsByCat.get(cat.id) ?? []
          if (catItems.length === 0) return null
          return (
            <section key={cat.id}>
              <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{cat.name}</h2>
              <div className="space-y-2">
                {catItems.map(it => (
                  <MenuItemCard
                    key={it.id}
                    id={it.id}
                    name={it.name}
                    description={it.description}
                    price_pesewas={it.price_pesewas}
                    photo_url={it.photo_url}
                    is_sold_out={it.is_sold_out}
                    initialQty={qtyOf(it.id)}
                    onChange={updateQty}
                    color={color}
                  />
                ))}
              </div>
            </section>
          )
        })}
        {(itemsByCat.get('other') ?? []).length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Other</h2>
            <div className="space-y-2">
              {(itemsByCat.get('other') ?? []).map(it => (
                <MenuItemCard
                  key={it.id}
                  id={it.id}
                  name={it.name}
                  description={it.description}
                  price_pesewas={it.price_pesewas}
                  photo_url={it.photo_url}
                  is_sold_out={it.is_sold_out}
                  initialQty={qtyOf(it.id)}
                  onChange={updateQty}
                  color={color}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {cartCount > 0 && (
        <div
          className="fixed bottom-[88px] left-1/2 z-30 w-[calc(100%-2rem)] max-w-md -translate-x-1/2"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <Link href="/occupant-portal/food/cart"
            className="flex items-center justify-between rounded-2xl px-4 py-3.5 text-[13px] font-bold text-white shadow-[0_12px_28px_-8px_rgba(16,24,40,0.5)] transition-all active:scale-[0.98]"
            style={{ backgroundColor: color }}>
            <span className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> {cartCount} item{cartCount > 1 ? 's' : ''} · {ghs(cartTotal)}
            </span>
            <span>Review cart →</span>
          </Link>
        </div>
      )}
    </>
  )
}
