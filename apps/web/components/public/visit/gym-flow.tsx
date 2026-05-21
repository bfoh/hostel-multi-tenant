'use client'

import { useState } from 'react'
import { ShieldCheck, Dumbbell } from 'lucide-react'
import { WalkinPaymentActions } from './payment-actions'

interface Props {
  slug:        string
  pointId:     string
  pointName:   string
  dayPassPrice: number       // pesewas
  includes:    string[]
  brandColor:  string
}

function ghs(p: number) {
  return `GH₵ ${(p / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

export function GymFlow({
  slug, pointId, pointName, dayPassPrice, includes, brandColor,
}: Props) {
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [phone,     setPhone]     = useState('')
  const [email,     setEmail]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [method,    setMethod]    = useState<'online' | 'cash_at_pickup'>('online')

  const valid = firstName.trim().length > 0
    && lastName.trim().length > 0
    && phone.trim().length >= 9

  async function pay() {
    if (!valid || loading) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/public/${slug}/rp/${pointId}/visit`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          first_name:     firstName.trim(),
          last_name:      lastName.trim(),
          phone:          phone.trim(),
          email:          email.trim() || null,
          input:          {},
          payment_method: method,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not start payment.')
        return
      }
      window.location.href = data.authorization_url
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Pricing card */}
      <div
        className="rounded-2xl p-5 text-white"
        style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}CC)` }}
      >
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider opacity-80">
          <Dumbbell className="h-3.5 w-3.5" />
          {pointName}
        </div>
        <p className="mt-2 text-xs opacity-80">Day pass</p>
        <p className="text-3xl font-bold">{ghs(dayPassPrice)}</p>
        <p className="mt-2 text-xs opacity-80">Valid for 24 hours after purchase</p>
        {includes && includes.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs opacity-90">
            {includes.map((i) => (
              <li key={i} className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3" />
                {i}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Visitor form */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              First name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={firstName}
              maxLength={80}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Kwame"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Last name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={lastName}
              maxLength={80}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Mensah"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Phone <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={phone}
            maxLength={20}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0244 000 000"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-gray-400">
            We&apos;ll text your entry code to this number.
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Email <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <WalkinPaymentActions
        amount={dayPassPrice}
        loading={loading}
        disabled={!valid}
        brandColor={brandColor}
        method={method}
        onMethodChange={setMethod}
        onSubmit={pay}
        cashLabel="Pay cash on entry"
      />
    </div>
  )
}
