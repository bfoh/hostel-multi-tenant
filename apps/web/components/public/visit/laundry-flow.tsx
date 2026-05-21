'use client'

import { useState, useMemo } from 'react'
import { Shirt, Scale, Clock } from 'lucide-react'
import { WalkinPaymentActions } from './payment-actions'

interface Props {
  slug:            string
  pointId:         string
  pointName:       string
  ratePerKg:       number   // pesewas
  minCharge:       number   // pesewas
  turnaroundHours: number
  brandColor:      string
}

function ghs(p: number) {
  return `GH₵ ${(p / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

export function LaundryFlow({
  slug, pointId, pointName, ratePerKg, minCharge, turnaroundHours, brandColor,
}: Props) {
  const [weight, setWeight]       = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [phone,     setPhone]     = useState('')
  const [email,     setEmail]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [method,    setMethod]    = useState<'online' | 'cash_at_pickup'>('online')

  const weightNum = parseFloat(weight)
  const weightOk  = Number.isFinite(weightNum) && weightNum > 0 && weightNum <= 50

  const amount = useMemo(() => {
    if (!weightOk) return 0
    const raw = Math.round(ratePerKg * weightNum)
    return Math.max(raw, minCharge)
  }, [ratePerKg, minCharge, weightNum, weightOk])

  const minChargeHit = weightOk && Math.round(ratePerKg * weightNum) < minCharge

  const readyEstimate = useMemo(() => {
    const t = new Date(Date.now() + turnaroundHours * 3600_000)
    return t.toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' })
  }, [turnaroundHours])

  const valid = weightOk
    && firstName.trim().length > 0
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
          input:          { weight_kg: weightNum },
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
      {/* Rate banner */}
      <div
        className="rounded-2xl p-5 text-white"
        style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}CC)` }}
      >
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider opacity-80">
          <Shirt className="h-3.5 w-3.5" />
          {pointName}
        </div>
        <p className="mt-2 text-3xl font-bold">{ghs(ratePerKg)}<span className="text-sm font-medium opacity-80"> / kg</span></p>
        <p className="mt-1 text-xs opacity-80">
          Minimum charge {ghs(minCharge)} · Ready in ~{turnaroundHours}h
        </p>
      </div>

      {/* Weight */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          <Scale className="mr-1 inline h-3 w-3" />
          Weight (kg) <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            min={0.1}
            max={50}
            step={0.1}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="3.5"
            className="w-full rounded-lg border border-gray-300 pl-3 pr-12 py-3 text-lg font-mono focus:border-gray-400 focus:outline-none"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-400">kg</span>
        </div>
        <p className="mt-1 text-[11px] text-gray-400">
          Ask the attendant for your weight at the counter.
        </p>
      </div>

      {/* Live price */}
      {weightOk && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {weightNum.toFixed(2)} kg × {ghs(ratePerKg)}/kg
            </span>
            <span className="font-mono">{ghs(Math.round(ratePerKg * weightNum))}</span>
          </div>
          {minChargeHit && (
            <div className="flex items-center justify-between text-xs text-amber-700">
              <span>Minimum charge applies</span>
              <span className="font-mono">{ghs(minCharge)}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-gray-200 pt-1.5 text-sm font-semibold">
            <span className="text-gray-900">Total to pay</span>
            <span className="font-mono">{ghs(amount)}</span>
          </div>
          <p className="flex items-center gap-1 pt-1 text-[11px] text-gray-500">
            <Clock className="h-3 w-3" />
            Pickup ready around {readyEstimate}
          </p>
        </div>
      )}

      {/* Visitor */}
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
            We&apos;ll text your pickup code here.
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

      {weightOk ? (
        <WalkinPaymentActions
          amount={amount}
          loading={loading}
          disabled={!valid}
          brandColor={brandColor}
          method={method}
          onMethodChange={setMethod}
          onSubmit={pay}
          cashLabel="Pay cash on pickup"
        />
      ) : (
        <button
          disabled
          className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white opacity-40 cursor-not-allowed"
          style={{ backgroundColor: brandColor }}
        >
          Enter weight to continue
        </button>
      )}
    </div>
  )
}
