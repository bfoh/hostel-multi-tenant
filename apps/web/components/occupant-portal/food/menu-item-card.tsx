'use client'

import { useState } from 'react'
import { Plus, Minus, Loader2 } from 'lucide-react'
import { haptics } from '@/lib/native/haptics'

interface Props {
  id:            string
  name:          string
  description:   string | null
  price_pesewas: number
  photo_url:     string | null
  is_sold_out:   boolean
  initialQty:    number
  onChange:      (id: string, qty: number) => Promise<void>
  color:         string
}

function ghs(pesewas: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(pesewas / 100)
}

export function MenuItemCard({ id, name, description, price_pesewas, photo_url, is_sold_out, initialQty, onChange, color }: Props) {
  const [qty,  setQty]  = useState(initialQty)
  const [busy, setBusy] = useState(false)

  const update = async (next: number) => {
    if (next < 0 || next > 10) return
    const prev = qty
    setQty(next)
    setBusy(true)
    haptics.light()
    try { await onChange(id, next) } catch { setQty(prev); haptics.error() }
    setBusy(false)
  }

  return (
    <div className={`flex gap-3 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_28px_-20px_rgba(16,24,40,0.18)] ${is_sold_out ? 'opacity-60' : ''}`}>
      {photo_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={photo_url} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
        : <div className="h-20 w-20 shrink-0 rounded-xl bg-slate-100" />}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-slate-900">{name}</p>
        {description && <p className="mt-0.5 text-[12px] text-slate-500 line-clamp-2">{description}</p>}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-900">{ghs(price_pesewas)}</span>
          {is_sold_out
            ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">Sold out</span>
            : qty === 0
              ? <button onClick={() => update(1)} disabled={busy}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: color }}>
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add
                </button>
              : <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-1 py-0.5">
                  <button onClick={() => update(qty - 1)} disabled={busy}
                    className="rounded-full p-1 hover:bg-slate-100">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="min-w-[1.25rem] text-center text-xs font-semibold">{qty}</span>
                  <button onClick={() => update(qty + 1)} disabled={busy || qty >= 10}
                    className="rounded-full p-1 hover:bg-slate-100">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
          }
        </div>
      </div>
    </div>
  )
}
