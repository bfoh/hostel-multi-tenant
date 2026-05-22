'use client'

import { useState } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { PhotoUpload } from './photo-upload'
import { useBulkSelect, BulkActionBar } from '@/components/ui/bulk-select'

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
  const [cats, setCats]   = useState<Category[]>(initialCategories)
  const [items, setItems] = useState<Item[]>(initialItems)
  const [busy, setBusy]   = useState<string | null>(null)
  const [newCat, setNewCat] = useState('')
  const [error, setError] = useState<string | null>(null)

  const bulk = useBulkSelect(items.map((i) => i.id))

  async function readError(res: Response): Promise<string> {
    try {
      const j = await res.json()
      if (typeof j?.error === 'string') return j.error
      if (j?.error) return JSON.stringify(j.error)
      return `${res.status} ${res.statusText}`
    } catch {
      return `${res.status} ${res.statusText}`
    }
  }

  async function addCat() {
    const trimmed = newCat.trim()
    if (!trimmed) return
    setBusy('add-cat'); setError(null)
    try {
      const res = await fetch('/api/menu/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, sort_order: cats.length }),
      })
      if (!res.ok) {
        setError(`Add category failed: ${await readError(res)}`)
        return
      }
      const j = await res.json().catch(() => ({})) as { id?: string }
      if (!j.id) {
        setError('Add category: server returned no id')
        return
      }
      // Append to local state — `useState(initialCategories)` doesn't re-seed
      // when the server component re-renders, so we have to track new rows
      // ourselves.
      const newRow: Category = {
        id:         j.id,
        name:       trimmed,
        sort_order: cats.length,
        is_active:  true,
      }
      setCats(prev => [...prev, newRow])
      setNewCat('')
    } catch (err) {
      setError(`Add category network error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(null)
    }
  }

  async function delCat(id: string) {
    if (!confirm('Delete this category? Items keep their data but lose category.')) return
    setBusy(`cat-${id}`); setError(null)
    try {
      const res = await fetch(`/api/menu/categories/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        setError(`Delete category failed: ${await readError(res)}`)
        return
      }
      setCats(prev => prev.filter(c => c.id !== id))
      setItems(prev => prev.map(i => i.category_id === id ? { ...i, category_id: null } : i))
    } finally {
      setBusy(null)
    }
  }

  async function patchItem(id: string, body: any) {
    setError(null)
    try {
      const res = await fetch(`/api/menu/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        setError(`Update item failed: ${await readError(res)}`)
        return
      }
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...body } : i))
    } catch (err) {
      setError(`Update item network error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function delItem(id: string) {
    if (!confirm('Delete this item permanently?')) return
    setBusy(`item-${id}`); setError(null)
    try {
      const res = await fetch(`/api/menu/items/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        setError(`Delete item failed: ${await readError(res)}`)
        return
      }
      setItems(prev => prev.filter(i => i.id !== id))
    } finally {
      setBusy(null)
    }
  }

  function appendItem(it: Item) {
    setItems(prev => [...prev, it])
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-danger/30 bg-red-50 px-3 py-2 text-xs text-red-800">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-semibold">×</button>
        </div>
      )}

      <section className="rounded-xl border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold text-text-primary">Categories</h3>
        <ul className="mt-3 space-y-2">
          {cats.map(c => (
            <li key={c.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <span className="text-sm">{c.name}</span>
              <button type="button" onClick={() => delCat(c.id)} disabled={busy === `cat-${c.id}`} className="text-text-secondary hover:text-danger">
                {busy === `cat-${c.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </li>
          ))}
          {cats.length === 0 && (
            <li className="rounded-lg border border-dashed border-border px-3 py-2 text-center text-xs text-text-tertiary">
              No categories yet — add one below.
            </li>
          )}
        </ul>
        <div className="mt-3 flex items-center gap-2">
          <input value={newCat} onChange={e => setNewCat(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCat() } }}
            placeholder="New category name"
            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm" />
          <button type="button" onClick={addCat} disabled={busy === 'add-cat' || !newCat.trim()}
            className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-brand-fg disabled:opacity-50">
            {busy === 'add-cat' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Items</h3>
            <p className="mt-0.5 text-xs text-text-secondary">Toggle Sold out / Available without leaving the page. Edit price + name inline. Use the new-item form to add.</p>
          </div>
          {items.length > 0 && (
            <BulkActionBar bulk={bulk} resource="menu_items" itemNoun="item" />
          )}
        </div>
        <NewItemForm cats={cats} nextSortOrder={items.length} onCreated={appendItem} onError={setError} />
        <ul className="mt-3 divide-y divide-border">
          {items.map(it => (
            <li key={it.id} className="relative grid grid-cols-12 items-center gap-3 py-3">
              {bulk.selectMode && (
                <input
                  type="checkbox"
                  checked={bulk.isSelected(it.id)}
                  onChange={() => bulk.toggle(it.id)}
                  className="absolute left-0 top-4 z-10 h-4 w-4 rounded border-border text-brand focus:ring-brand"
                />
              )}
              <div className={`col-span-2 ${bulk.selectMode ? 'pl-6' : ''}`}><PhotoUpload itemId={it.id} currentUrl={it.photo_url} onUploaded={url => setItems(prev => prev.map(i => i.id === it.id ? { ...i, photo_url: url } : i))} /></div>
              <div className="col-span-4">
                <input defaultValue={it.name} onBlur={e => e.target.value !== it.name && patchItem(it.id, { name: e.target.value })}
                  className="w-full rounded border border-border px-2 py-1 text-sm font-medium" />
                <select value={it.category_id ?? ''} onChange={e => patchItem(it.id, { category_id: e.target.value || null })}
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
                  <input type="checkbox" checked={it.is_available} onChange={e => patchItem(it.id, { is_available: e.target.checked })} />
                  Available
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={it.is_sold_out} onChange={e => patchItem(it.id, { is_sold_out: e.target.checked })} />
                  Sold out
                </label>
                <input type="date" value={it.publish_date ?? ''}
                  onChange={e => patchItem(it.id, { publish_date: e.target.value || null })}
                  className="w-full rounded border border-border px-2 py-0.5 text-[11px]" />
              </div>
              <div className="col-span-1 text-right">
                <button type="button" onClick={() => delItem(it.id)} disabled={busy === `item-${it.id}`}
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

function NewItemForm({ cats, nextSortOrder, onCreated, onError }: {
  cats:           Category[]
  nextSortOrder:  number
  onCreated:      (item: Item) => void
  onError:        (msg: string) => void
}) {
  const [name,  setName]  = useState('')
  const [price, setPrice] = useState('')
  const [cat,   setCat]   = useState<string>('')
  const [busy,  setBusy]  = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    const cents = Math.round(parseFloat(price || '0') * 100)
    if (!trimmedName) { onError('Item name is required'); return }
    if (cents <= 0)   { onError('Price must be greater than 0'); return }

    setBusy(true)
    try {
      const res = await fetch('/api/menu/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:          trimmedName,
          price_pesewas: cents,
          category_id:   cat || null,
          is_available:  true,
        }),
      })
      if (!res.ok) {
        let msg: string
        try {
          const j = await res.json()
          msg = typeof j?.error === 'string' ? j.error : JSON.stringify(j?.error ?? `${res.status} ${res.statusText}`)
        } catch {
          msg = `${res.status} ${res.statusText}`
        }
        onError(`Add item failed: ${msg}`)
        return
      }
      const j = await res.json().catch(() => ({})) as { id?: string }
      if (!j.id) {
        onError('Add item: server returned no id')
        return
      }
      onCreated({
        id:            j.id,
        category_id:   cat || null,
        name:          trimmedName,
        description:   null,
        price_pesewas: cents,
        photo_url:     null,
        is_available:  true,
        is_sold_out:   false,
        publish_date:  null,
        sort_order:    nextSortOrder,
      })
      setName(''); setPrice('')
    } catch (err) {
      onError(`Add item network error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 grid grid-cols-12 gap-2 rounded-lg border border-dashed border-border p-3">
      <input className="col-span-5 rounded border border-border px-2 py-1.5 text-sm" placeholder="Item name" value={name} onChange={e => setName(e.target.value)} />
      <input type="number" step="0.01" className="col-span-2 rounded border border-border px-2 py-1.5 text-sm" placeholder="GHS" value={price} onChange={e => setPrice(e.target.value)} />
      <select className="col-span-3 rounded border border-border px-2 py-1.5 text-sm" value={cat} onChange={e => setCat(e.target.value)}>
        <option value="">— Category —</option>
        {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <button type="submit" disabled={busy || !name.trim() || !price.trim()} className="col-span-2 rounded bg-brand px-3 py-1.5 text-sm font-semibold text-brand-fg disabled:opacity-50">
        {busy ? '…' : 'Add item'}
      </button>
    </form>
  )
}
