'use client'

import { useState } from 'react'
import { Plus, Loader2, X, ChevronDown, ChevronUp, Receipt } from 'lucide-react'
import { formatGHS } from '@/lib/utils'

interface Charge {
  id: string
  description: string
  category: string
  quantity: number
  unit_price: number
  amount: number
  payment_method: string | null
  paid: boolean
  notes: string | null
  created_at: string
}

const CATEGORY_LABEL: Record<string, string> = {
  food_beverage:  'Food & Beverage',
  room_service:   'Room Service',
  minibar:        'Minibar',
  laundry:        'Laundry',
  phone_internet: 'Phone / Internet',
  parking:        'Parking',
  other:          'Other',
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', card: 'Card', bank_transfer: 'Bank Transfer', cheque: 'Cheque',
  momo_mtn: 'MTN MoMo', momo_vodafone: 'Vodafone Cash', momo_airteltigo: 'AirtelTigo Money',
}

/**
 * Folio line-items (minibar, laundry, room service, etc.) added to a
 * hotel booking — ported from AMP Lodge's charges feature. Rendered only
 * for hotel tenants (isHotel check in the parent page).
 */
export function BookingChargesCard({
  bookingId,
  initialCharges,
  canEdit,
}: {
  bookingId: string
  initialCharges: Charge[]
  canEdit: boolean
}) {
  const [charges, setCharges] = useState(initialCharges)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('other')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [payLater, setPayLater] = useState(false)
  const [notes, setNotes] = useState('')

  const total = charges.reduce((s, c) => s + c.amount, 0)
  const owed = charges.filter((c) => !c.paid).reduce((s, c) => s + c.amount, 0)

  async function addCharge() {
    const qty = parseInt(quantity, 10)
    const priceNum = Math.round(parseFloat(unitPrice) * 100)
    if (!description.trim()) { setError('Enter a description'); return }
    if (!qty || qty <= 0) { setError('Enter a valid quantity'); return }
    if (isNaN(priceNum) || priceNum < 0) { setError('Enter a valid unit price'); return }

    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/charges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          category,
          quantity: qty,
          unit_price: priceNum,
          payment_method: payLater ? null : paymentMethod,
          paid: !payLater,
          notes: notes.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to add charge')
      setCharges((prev) => [data, ...prev])
      setShowForm(false)
      setDescription(''); setCategory('other'); setQuantity('1'); setUnitPrice(''); setNotes(''); setPayLater(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add charge')
    } finally {
      setSaving(false)
    }
  }

  async function removeCharge(chargeId: string) {
    setRemoving(chargeId); setError(null)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/charges/${chargeId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to remove charge')
      }
      setCharges((prev) => prev.filter((c) => c.id !== chargeId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove charge')
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="space-y-4">
      {charges.length > 0 ? (
        <div className="space-y-2">
          {charges.map((c) => (
            <div key={c.id} className="flex items-start justify-between rounded-lg bg-surface-raised p-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-text-primary">{c.description}</span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-tertiary">
                    {CATEGORY_LABEL[c.category] ?? c.category}
                  </span>
                  {!c.paid && (
                    <span className="rounded-full border border-warning/20 bg-warning-subtle px-2 py-0.5 text-[11px] font-medium text-warning-fg">
                      Pay later
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-text-tertiary">
                  {c.quantity} × {formatGHS(c.unit_price)}
                  {c.paid && c.payment_method && <> · {METHOD_LABEL[c.payment_method] ?? c.payment_method}</>}
                </p>
                {c.notes && <p className="mt-1 text-xs text-text-tertiary">{c.notes}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="currency-amount text-sm font-semibold text-text-primary">{formatGHS(c.amount)}</span>
                {canEdit && (
                  <button
                    onClick={() => removeCharge(c.id)}
                    disabled={removing === c.id}
                    className="text-text-tertiary hover:text-danger disabled:opacity-50"
                    aria-label="Remove charge"
                  >
                    {removing === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
            <span className="text-text-tertiary">Charges total</span>
            <span className="currency-amount font-semibold text-text-primary">{formatGHS(total)}</span>
          </div>
          {owed > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-tertiary">Unpaid (owed)</span>
              <span className="currency-amount font-semibold text-warning-fg">{formatGHS(owed)}</span>
            </div>
          )}
        </div>
      ) : (
        !showForm && (
          <div className="flex items-center gap-2 text-sm text-text-tertiary">
            <Receipt className="h-4 w-4" />
            No additional charges yet
          </div>
        )
      )}

      {canEdit && (
        <div>
          <button
            onClick={() => { setShowForm((p) => !p); setError(null) }}
            className="flex items-center gap-1.5 text-sm text-brand hover:underline"
          >
            {showForm
              ? <><ChevronUp className="h-4 w-4" /> Cancel</>
              : <><Plus className="h-4 w-4" /> Add charge</>}
          </button>

          {showForm && (
            <div className="mt-3 space-y-3">
              <input
                placeholder="Description (e.g. Minibar — 2 beers)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    {Object.entries(CATEGORY_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Quantity</label>
                  <input
                    type="number" min="1" step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Unit price (GHS)</label>
                  <input
                    type="number" step="0.01" min="0"
                    placeholder="0.00"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input type="checkbox" checked={payLater} onChange={(e) => setPayLater(e.target.checked)} className="h-3.5 w-3.5" />
                Pay later (add to folio, no payment collected now)
              </label>

              {!payLater && (
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Payment method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    {Object.entries(METHOD_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              )}

              <input
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />

              {error && <p className="text-xs text-danger">{error}</p>}

              <button
                onClick={addCharge}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Add charge
              </button>
            </div>
          )}
        </div>
      )}

      {!canEdit && error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
