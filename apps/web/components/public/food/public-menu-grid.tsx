'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { PublicMenuItemCard } from './public-menu-item-card'

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

const CART_KEY = (slug: string) => `food-cart:${slug}`

export function PublicMenuGrid({ slug, categories, items, color }: {
  slug:       string
  categories: Category[]
  items:      Item[]
  color:      string
}) {
  const [cart, setCart] = useState<CartLine[]>([])

  // Hydrate cart from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY(slug))
      if (raw) {
        const parsed = JSON.parse(raw) as CartLine[]
        // Drop any items that are no longer on today's menu
        const validIds = new Set(items.map(i => i.id))
        setCart(parsed.filter(c => validIds.has(c.menu_item_id) && c.quantity > 0).slice(0, 50))
      }
    } catch {}
  }, [slug, items])

  // Persist on change
  useEffect(() => {
    try { localStorage.setItem(CART_KEY(slug), JSON.stringify(cart)) } catch {}
  }, [cart, slug])

  const qtyOf = (id: string) => cart.find(c => c.menu_item_id === id)?.quantity ?? 0

  const updateQty = (id: string, qty: number) => {
    setCart(prev => {
      if (qty === 0) return prev.filter(c => c.menu_item_id !== id)
      if (prev.find(c => c.menu_item_id === id)) {
        return prev.map(c => c.menu_item_id === id ? { ...c, quantity: qty } : c)
      }
      return [...prev, { menu_item_id: id, quantity: qty }]
    })
  }

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, c) => {
      const it = items.find(i => i.id === c.menu_item_id)
      return sum + (it?.price_pesewas ?? 0) * c.quantity
    }, 0)
  }, [cart, items])

  const cartCount = cart.reduce((n, c) => n + c.quantity, 0)

  const itemsByCat = new Map<string | 'other', Item[]>()
  for (const it of items) {
    const k = it.category_id ?? 'other'
    if (!itemsByCat.has(k)) itemsByCat.set(k, [])
    itemsByCat.get(k)!.push(it)
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-500">No items on today's menu</p>
        <p className="mt-1 text-xs text-slate-400">Check back later.</p>
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
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">{cat.name}</h2>
              <div className="space-y-2">
                {catItems.map(it => (
                  <PublicMenuItemCard
                    key={it.id}
                    id={it.id}
                    name={it.name}
                    description={it.description}
                    price_pesewas={it.price_pesewas}
                    photo_url={it.photo_url}
                    is_sold_out={it.is_sold_out}
                    qty={qtyOf(it.id)}
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
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Other</h2>
            <div className="space-y-2">
              {(itemsByCat.get('other') ?? []).map(it => (
                <PublicMenuItemCard
                  key={it.id}
                  id={it.id}
                  name={it.name}
                  description={it.description}
                  price_pesewas={it.price_pesewas}
                  photo_url={it.photo_url}
                  is_sold_out={it.is_sold_out}
                  qty={qtyOf(it.id)}
                  onChange={updateQty}
                  color={color}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {cartCount > 0 && (
        <div className="fixed bottom-4 left-1/2 z-30 w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
          <Link href={`/order/${slug}/cart`}
            className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-lg"
            style={{ backgroundColor: color }}>
            <span className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> {cartCount} item{cartCount > 1 ? 's' : ''} · {ghs(cartTotal)}
            </span>
            <span>Checkout →</span>
          </Link>
        </div>
      )}
    </>
  )
}
