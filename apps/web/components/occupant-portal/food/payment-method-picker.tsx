'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export function PaymentMethodPicker({ color, total, onlineEnabled }: {
  color:         string
  total:         number   // pesewas
  onlineEnabled: boolean  // tenant has paystack subaccount
}) {
  const router = useRouter()
  const [method, setMethod] = useState<'online' | 'cash_on_pickup'>(onlineEnabled ? 'online' : 'cash_on_pickup')
  const [notes,  setNotes]  = useState('')
  const [busy,   setBusy]   = useState(false)
  const [err,    setErr]    = useState<string | null>(null)

  async function place() {
    setErr(null); setBusy(true)
    const res = await fetch('/api/occupant/food-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_method: method, notes: notes || null }),
    })
    setBusy(false)
    if (!res.ok) {
      const j = await res.json().catch(() => null) as any
      setErr(j?.error ?? 'Order failed')
      return
    }
    const j = await res.json()
    if (method === 'online' && j.authorization_url) {
      window.location.href = j.authorization_url
    } else {
      router.push(`/occupant-portal/food/orders/${j.id}`)
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-700">Payment method</h2>
      <div className="space-y-2">
        {onlineEnabled && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
            <input type="radio" checked={method === 'online'} onChange={() => setMethod('online')} className="mt-0.5" />
            <div>
              <p className="text-sm font-medium text-slate-900">Pay online</p>
              <p className="mt-0.5 text-xs text-slate-500">MoMo, card, or bank — via Paystack. Order goes to kitchen after payment confirms.</p>
            </div>
          </label>
        )}
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
          <input type="radio" checked={method === 'cash_on_pickup'} onChange={() => setMethod('cash_on_pickup')} className="mt-0.5" />
          <div>
            <p className="text-sm font-medium text-slate-900">Pay on pickup</p>
            <p className="mt-0.5 text-xs text-slate-500">Cash. Kitchen starts preparing immediately.</p>
          </div>
        </label>
      </div>

      <textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={280} rows={2}
        placeholder="Note for kitchen (optional)"
        className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm" />

      {err && <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{err}</p>}

      <button onClick={place} disabled={busy || total === 0}
        className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white disabled:opacity-50"
        style={{ backgroundColor: color }}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {method === 'online' ? 'Pay & place order' : 'Place order'}
      </button>
    </div>
  )
}
