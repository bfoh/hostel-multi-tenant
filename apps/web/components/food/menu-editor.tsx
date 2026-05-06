'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { PhotoUpload } from './photo-upload'

interface Category { id: string; name: string; sort_order: number; is_active: boolean }
interface Item {
  id:           string
  category_id:  string | null
  name:         string
  description:  string | null
  price_pesewas: number
  photo_url:    string | null
  is_available: boolean
  is_sold_out:  boolean
  publish_date: string | null
  sort_order:   number
}

export function MenuEditor({ initialCategories, initialItems }: {
  initialCategories: Category[]
  initialItems:      Item[]
}) {
  const router = useRouter()
  const [cats, setCats]   = useState(initialCategories)
  const [items, setItems] = useState(initialItems)
  const [busy, setBusy]   = useState<string | null>(null)
  const [newCat, setNewCat] = useState('')

  async function addCat() {
    if (!newCat.trim()) return
    setBusy('add-cat')
    const res = await fetch('/api/menu/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCat.trim(), sort_order: cats.length }),
    })
    setBusy(null)
    if (res.ok) { setNewCat(''); router.refresh() }
  }

  async function delCat(id: string) {
    if (!confirm('Delete this category? Items keep their data but lose category.')) return
    setBusy(`cat-${id}`)
    await fetch(`/api/menu/categories/${id}`, { method: 'DELETE' })
    setBusy(null)
    setCats(cats.filter(c => c.id !== id))
    setItems(items.map(i => i.category_id === id ? { ...i, category_id: null } : i))
  }

  async function patchItem(id: string, body: any) {
    const res = await fetch(`/api/menu/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setItems(items.map(i => i.id === id ? { ...i, ...body } : i))
    }
  }

  async function delItem(id: string) {
    if (!confirm('Delete this item permanently?')) return
    setBusy(`item-${id}`)
    await fetch(`/api/menu/items/${id}`, { method: 'DELETE' })
    setBusy(null)
    setItems(items.filter(i => i.id !== id))
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold text-text-primary">Categories</h3>
        <ul className="mt-3 space-y-2">
          {cats.map(c => (
            <li key={c.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <span className="text-sm">{c.name}</span>
              <button onClick={() => delCat(c.id)} disabled={busy === `cat-${c.id}`} className="text-text-secondary hover:text-danger">
                {busy === `cat-${c.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center gap-2">
          <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="New category name"
            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm" />
          <button onClick={addCat} disabled={busy === 'add-cat'}
            className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-brand-fg disabled:opacity-50">
            {busy === 'add-cat' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold text-text-primary">Items</h3>
        <p className="mt-0.5 text-xs text-text-secondary">Toggle Sold out / Available without leaving the page. Edit price + name inline. Use the new-item form to add.</p>
        <NewItemForm cats={cats} onCreated={() => router.refresh()} />
        <ul className="mt-3 divide-y divide-border">
          {items.map(it => (
            <li key={it.id} className="grid grid-cols-12 items-center gap-3 py-3">
              <div className="col-span-2"><PhotoUpload itemId={it.id} currentUrl={it.photo_url} onUploaded={url => setItems(items.map(i => i.id === it.id ? { ...i, photo_url: url } : i))} /></div>
              <div className="col-span-4">
                <input defaultValue={it.name} onBlur={e => e.target.value !== it.name && patchItem(it.id, { name: e.target.value })}
                  className="w-full rounded border border-border px-2 py-1 text-sm font-medium" />
                <select defaultValue={it.category_id ?? ''} onChange={e => patchItem(it.id, { category_id: e.target.value || null })}
                  className="mt-1 w-full rounded border border-border px-2 py-1 text-xs">
                  <option value="">— No category —</option>
                  {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <input type="number" defaultValue={(it.price_pesewas / 100).toFixed(2)}
                  onBlur={e => {
                    const cents = Math.round(parseFloat(e.target.value || '0') * 100)
                    if (cents > 0 && cents !== it.price_pesewas) patchItem(it.id, { price_pesewas: cents })
                  }}
                  className="w-full rounded border border-border px-2 py-1 text-sm" />
                <p className="mt-0.5 text-[10px] text-text-tertiary">GHS</p>
              </div>
              <div className="col-span-3 space-y-1 text-xs">
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked={it.is_available} onChange={e => patchItem(it.id, { is_available: e.target.checked })} />
                  Available
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked={it.is_sold_out} onChange={e => patchItem(it.id, { is_sold_out: e.target.checked })} />
                  Sold out
                </label>
                <input type="date" defaultValue={it.publish_date ?? ''}
                  onChange={e => patchItem(it.id, { publish_date: e.target.value || null })}
                  className="w-full rounded border border-border px-2 py-0.5 text-[11px]" />
              </div>
              <div className="col-span-1 text-right">
                <button onClick={() => delItem(it.id)} disabled={busy === `item-${it.id}`}
                  className="text-text-secondary hover:text-danger">
                  {busy === `item-${it.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function NewItemForm({ cats, onCreated }: { cats: Category[]; onCreated: () => void }) {
  const [name,  setName]  = useState('')
  const [price, setPrice] = useState('')
  const [cat,   setCat]   = useState<string>('')
  const [busy,  setBusy]  = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const cents = Math.round(parseFloat(price || '0') * 100)
    if (!name.trim() || cents <= 0) return
    setBusy(true)
    const res = await fetch('/api/menu/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:          name.trim(),
        price_pesewas: cents,
        category_id:   cat || null,
        is_available:  true,
      }),
    })
    setBusy(false)
    if (res.ok) { setName(''); setPrice(''); onCreated() }
  }

  return (
    <form onSubmit={submit} className="mt-3 grid grid-cols-12 gap-2 rounded-lg border border-dashed border-border p-3">
      <input className="col-span-5 rounded border border-border px-2 py-1.5 text-sm" placeholder="Item name" value={name} onChange={e => setName(e.target.value)} />
      <input type="number" step="0.01" className="col-span-2 rounded border border-border px-2 py-1.5 text-sm" placeholder="GHS" value={price} onChange={e => setPrice(e.target.value)} />
      <select className="col-span-3 rounded border border-border px-2 py-1.5 text-sm" value={cat} onChange={e => setCat(e.target.value)}>
        <option value="">— Category —</option>
        {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <button type="submit" disabled={busy} className="col-span-2 rounded bg-brand px-3 py-1.5 text-sm font-semibold text-brand-fg disabled:opacity-50">
        {busy ? '…' : 'Add item'}
      </button>
    </form>
  )
}
