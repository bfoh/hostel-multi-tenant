'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, ExternalLink } from 'lucide-react'
import { formatGHS } from '@/lib/utils'

const GHANA_REGIONS = [
  'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern',
  'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah',
  'Upper East', 'Upper West', 'Volta', 'Western', 'Western North',
]

interface Category {
  id:        string
  name:      string
  base_rate: number
  rate_unit: string
}

interface Props {
  slug:                 string
  initialListed:        boolean
  initialPaymentMode:   'online' | 'pay_at_hostel'
  initialCity:          string | null
  initialRegion:        string | null
  hasPayoutAccount:     boolean
  categories:           Category[]
}

const inputCls = 'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder-text-tertiary focus:border-brand focus:outline-none transition-colors'

export function ListingSettingsForm({
  slug, initialListed, initialPaymentMode, initialCity, initialRegion, hasPayoutAccount, categories,
}: Props) {
  const [listed,      setListed]      = useState(initialListed)
  const [paymentMode, setPaymentMode] = useState(initialPaymentMode)
  const [city,        setCity]        = useState(initialCity ?? '')
  const [region,      setRegion]      = useState(initialRegion ?? '')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState('')

  async function save() {
    setSaving(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/settings/listing', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listed_publicly:      listed,
          booking_payment_mode: paymentMode,
          address_city:         city.trim() || null,
          address_region:       region || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : data.message ?? 'Failed to save')
      setSuccess('Listing settings saved.')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const marketplaceUrl = `https://${process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'}/hostels/${slug}`

  return (
    <div className="space-y-6">
      {error   && <p className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>}
      {success && <p className="rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">{success}</p>}

      {/* Public marketplace visibility */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-text-primary">List on the GH Hostels marketplace</p>
            <p className="mt-0.5 text-xs text-text-secondary">
              Prospective students can find and book your rooms directly, free — even after your trial ends.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={listed}
            onClick={() => setListed(!listed)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${listed ? 'bg-brand' : 'bg-border'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${listed ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {listed && (
          <a
            href={marketplaceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
          >
            View your public listing <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Guest checkout mode */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <p className="text-sm font-semibold text-text-primary">Guest checkout mode</p>
        <p className="text-xs text-text-secondary">
          How guests pay when they book your rooms from the public listing.
        </p>
        <div className="space-y-2">
          <label className="flex items-start gap-2.5 rounded-lg border border-border p-3 text-sm cursor-pointer has-[:checked]:border-brand has-[:checked]:bg-brand/5">
            <input
              type="radio"
              name="payment_mode"
              className="mt-0.5"
              checked={paymentMode === 'online'}
              disabled={!hasPayoutAccount}
              onChange={() => setPaymentMode('online')}
            />
            <span>
              <span className="font-medium text-text-primary">Pay online at booking</span>
              <span className="block text-xs text-text-secondary">
                Guest pays via Paystack when they book. Charged to your connected payout account.
                {!hasPayoutAccount && ' Connect a payout bank account first to enable this.'}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2.5 rounded-lg border border-border p-3 text-sm cursor-pointer has-[:checked]:border-brand has-[:checked]:bg-brand/5">
            <input
              type="radio"
              name="payment_mode"
              className="mt-0.5"
              checked={paymentMode === 'pay_at_hostel'}
              onChange={() => setPaymentMode('pay_at_hostel')}
            />
            <span>
              <span className="font-medium text-text-primary">Reserve now, pay at the hostel</span>
              <span className="block text-xs text-text-secondary">
                Booking is confirmed immediately with no online payment; guest pays on arrival.
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* Location */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <p className="text-sm font-semibold text-text-primary">Location</p>
        <p className="text-xs text-text-secondary">Used for search and filtering on the public marketplace.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">City / area</label>
            <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Kumasi" maxLength={100} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Region</label>
            <select className={inputCls} value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">Select a region</option>
              {GHANA_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Prices preview */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-text-primary">Room prices shown on your listing</p>
          <Link href="/rooms/categories" className="text-xs font-medium text-brand hover:underline">
            Edit prices
          </Link>
        </div>
        {categories.length === 0 ? (
          <p className="text-sm text-text-secondary">No room types configured yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-text-primary">{c.name}</span>
                <span className="font-medium text-text-secondary">
                  {formatGHS(c.base_rate)} / {c.rate_unit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
      </button>
    </div>
  )
}
