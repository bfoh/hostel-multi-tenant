'use client'

import { useState, useEffect } from 'react'
import { Loader2, Trophy, AlertTriangle, Clock } from 'lucide-react'
import { WalkinPaymentActions } from './payment-actions'

interface Court {
  id:          string
  name:        string
  hourly_rate: number   // pesewas
}

interface Props {
  slug:        string
  pointId:     string
  pointName:   string
  courts:      Court[]
  minMinutes:  number
  brandColor:  string
}

interface Conflict {
  id:            string
  ends_at:       string
  customer_name: string | null
}

function ghs(p: number) {
  return `GH₵ ${(p / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

const DURATION_OPTIONS = [60, 90, 120, 150, 180]

export function SportsFlow({
  slug, pointId, pointName, courts, minMinutes, brandColor,
}: Props) {
  const [courtId, setCourtId]     = useState<string>(courts[0]?.id ?? '')
  const [minutes, setMinutes]     = useState<number>(Math.max(minMinutes, 60))
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [phone,     setPhone]     = useState('')
  const [email,     setEmail]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [checking,  setChecking]  = useState(false)
  const [override,  setOverride]  = useState(false)
  const [method,    setMethod]    = useState<'online' | 'cash_at_pickup'>('online')

  const court = courts.find((c) => c.id === courtId)

  // Hourly rate billed by the half-hour
  const halfHours = Math.ceil(minutes / 30)
  const amount = court ? Math.round((court.hourly_rate / 2) * halfHours) : 0

  const validVisitor =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    phone.trim().length >= 9

  const valid = validVisitor && !!court && amount > 0

  // Soft conflict check whenever court or duration changes
  useEffect(() => {
    if (!courtId || !minutes) {
      setConflicts([])
      setOverride(false)
      return
    }
    let abort = false
    setChecking(true)
    fetch(`/api/public/${slug}/rp/${pointId}/sports/check?court_id=${encodeURIComponent(courtId)}&duration_minutes=${minutes}`)
      .then((r) => r.json())
      .then((data) => {
        if (abort) return
        setConflicts(Array.isArray(data?.conflicts) ? data.conflicts : [])
        setOverride(false)
      })
      .catch(() => {
        if (!abort) setConflicts([])
      })
      .finally(() => { if (!abort) setChecking(false) })
    return () => { abort = true }
  }, [courtId, minutes, slug, pointId])

  const hasConflict = conflicts.length > 0
  const canSubmit   = valid && (!hasConflict || override)

  async function pay() {
    if (!canSubmit || loading) return
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
          payment_method: method,
          input: {
            court_id:        courtId,
            duration_minutes: minutes,
          },
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
      {/* Hero */}
      <div
        className="rounded-2xl p-5 text-white"
        style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}CC)` }}
      >
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider opacity-80">
          <Trophy className="h-3.5 w-3.5" />
          {pointName}
        </div>
        <p className="mt-2 text-xs opacity-80">Book a court</p>
        <p className="text-3xl font-bold">{court ? ghs(court.hourly_rate) : '—'}
          <span className="text-sm font-medium opacity-80"> / hour</span>
        </p>
        <p className="mt-1 text-xs opacity-80">
          Minimum {minMinutes} min · billed by the half-hour
        </p>
      </div>

      {/* Court picker */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">
          Court <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {courts.map((c) => {
            const active = c.id === courtId
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCourtId(c.id)}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  active
                    ? 'border-transparent text-white'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
                style={active ? { backgroundColor: brandColor } : undefined}
              >
                <p className="text-sm font-semibold">{c.name}</p>
                <p className="text-[11px] opacity-80">{ghs(c.hourly_rate)} / hr</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Duration */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">
          Duration <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-5 gap-2">
          {DURATION_OPTIONS.filter((m) => m >= minMinutes).map((m) => {
            const active = m === minutes
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMinutes(m)}
                className={`rounded-lg border px-2 py-2 text-center text-sm font-medium transition-colors ${
                  active
                    ? 'border-transparent text-white'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
                style={active ? { backgroundColor: brandColor } : undefined}
              >
                {m / 60}h{m % 60 === 30 ? '½' : ''}
                {m === minutes && (
                  <span className="block text-[10px] opacity-80">selected</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Conflict warning */}
      {hasConflict && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="flex-1 text-xs text-amber-900">
              <p className="font-semibold">Court may be in use right now.</p>
              <ul className="mt-1 space-y-0.5">
                {conflicts.map((c) => (
                  <li key={c.id} className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {c.customer_name ?? 'Another guest'} — ends at{' '}
                    {new Date(c.ends_at).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })}
                  </li>
                ))}
              </ul>
              <p className="mt-2">
                Check with the attendant before booking the same slot.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 pl-6 text-xs text-amber-900">
            <input
              type="checkbox"
              checked={override}
              onChange={(e) => setOverride(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            I&apos;ve confirmed with the attendant
          </label>
        </div>
      )}

      {/* Price preview */}
      {court && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">{court.name} · {minutes} min</span>
            <span className="font-mono font-semibold">{ghs(amount)}</span>
          </div>
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

      {checking && (
        <p className="text-center text-[11px] text-gray-400 flex items-center justify-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Checking availability…
        </p>
      )}

      {hasConflict && !override ? (
        <button
          disabled
          className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white opacity-40 cursor-not-allowed"
          style={{ backgroundColor: brandColor }}
        >
          Confirm with attendant to continue
        </button>
      ) : (
        <WalkinPaymentActions
          amount={amount}
          loading={loading}
          disabled={!canSubmit}
          brandColor={brandColor}
          method={method}
          onMethodChange={setMethod}
          onSubmit={pay}
          cashLabel="Pay cash on court"
        />
      )}
    </div>
  )
}
