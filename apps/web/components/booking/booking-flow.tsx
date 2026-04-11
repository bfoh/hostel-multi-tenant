'use client'

import { useState } from 'react'
import { CheckCircle, BedDouble, User, Loader2 } from 'lucide-react'

interface RoomCategory {
  id: string
  name: string
  type: string
  base_rate: number
  rate_unit: string
  capacity: number
  amenities: string[]
  description: string | null
  available_count: number
}

interface Props {
  rooms: RoomCategory[]
  hostelSlug: string
}

type Step = 'room' | 'details' | 'success'

function ghs(p: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', minimumFractionDigits: 2 }).format(p / 100)
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
}

export function BookingFlow({ rooms, hostelSlug }: Props) {
  const [step, setStep]         = useState<Step>('room')
  const [selected, setSelected] = useState<RoomCategory | null>(null)

  // Form
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [phone,     setPhone]     = useState('')
  const [studentId, setStudentId] = useState('')
  const [checkIn,   setCheckIn]   = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')
  const [bookingRef, setBookingRef] = useState('')
  const [amount,     setAmount]     = useState(0)

  const steps: { key: Step; label: string; icon: React.ElementType }[] = [
    { key: 'room',    label: 'Choose room',    icon: BedDouble },
    { key: 'details', label: 'Your details',   icon: User },
    { key: 'success', label: 'Confirmation',   icon: CheckCircle },
  ]
  const stepIdx = steps.findIndex((s) => s.key === step)

  async function submitBooking() {
    if (!selected) return
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/widget/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostel_slug:    hostelSlug,
          category_id:   selected.id,
          check_in_date:  checkIn,
          check_out_date: null,
          first_name:    firstName.trim(),
          last_name:     lastName.trim(),
          email:         email.trim(),
          phone:         phone.trim(),
          student_id:    studentId.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Booking failed')
      setBookingRef(data.booking_ref)
      setAmount(data.amount)
      setStep('success')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {steps.map((s, i) => {
          const Icon    = s.icon
          const done    = i < stepIdx
          const current = i === stepIdx
          return (
            <div key={s.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors ${
                  done    ? 'bg-green-500 text-white' :
                  current ? 'bg-[#1B4F72] text-white' :
                            'bg-gray-200 text-gray-400'
                }`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className={`mt-1 text-xs font-medium ${current ? 'text-[#1B4F72]' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`h-0.5 flex-1 mx-2 mt-[-14px] transition-colors ${i < stepIdx ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step 1: Room selection */}
      {step === 'room' && (
        <div className="space-y-4">
          {rooms.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
              <BedDouble className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-3 text-gray-500">No rooms available at this time.</p>
              <p className="text-sm text-gray-400">Please check back later or contact us directly.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => setSelected(room)}
                  className={`w-full text-left rounded-xl border-2 p-5 transition-all ${
                    selected?.id === room.id
                      ? 'border-[#1B4F72] bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  } ${room.available_count === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={room.available_count === 0}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{room.name}</p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {cap(room.type)} · up to {room.capacity} {room.capacity === 1 ? 'person' : 'people'}
                      </p>
                      {room.amenities.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1">{room.amenities.slice(0, 4).join(' · ')}</p>
                      )}
                      {room.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{room.description}</p>
                      )}
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <p className="font-bold text-[#1B4F72] text-lg">{ghs(room.base_rate)}</p>
                      <p className="text-xs text-gray-400">/ {room.rate_unit}</p>
                      {room.available_count > 0 ? (
                        <p className="text-xs text-green-600 mt-1 font-medium">
                          {room.available_count} available
                        </p>
                      ) : (
                        <p className="text-xs text-red-500 mt-1 font-medium">Fully booked</p>
                      )}
                    </div>
                  </div>

                  {/* Selection indicator */}
                  {selected?.id === room.id && (
                    <div className="mt-3 flex items-center gap-1.5 text-[#1B4F72]">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Selected</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => { setError(''); setStep('details') }}
            disabled={!selected || selected.available_count === 0}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#1B4F72' }}
          >
            Continue to Details
          </button>
        </div>
      )}

      {/* Step 2: Occupant details */}
      {step === 'details' && selected && (
        <div className="space-y-5">
          {/* Selected room summary */}
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-sm font-semibold text-[#1B4F72]">{selected.name}</p>
            <p className="text-xs text-blue-600 mt-0.5">{ghs(selected.base_rate)} / {selected.rate_unit}</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Your Details</h2>

            <div className="grid grid-cols-2 gap-4">
              <Field label="First name *">
                <input
                  className="input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Kwame"
                />
              </Field>
              <Field label="Last name *">
                <input
                  className="input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Mensah"
                />
              </Field>
            </div>

            <Field label="Email address *">
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kwame@example.com"
              />
            </Field>

            <Field label="Phone / MoMo number *">
              <input
                type="tel"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0244 000 000"
              />
            </Field>

            <Field label="Student ID (optional)">
              <input
                className="input"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="STU-2025-001"
              />
            </Field>

            <Field label="Check-in date *">
              <input
                type="date"
                className="input"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </Field>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep('room')}
              className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={submitBooking}
              disabled={submitting || !firstName || !lastName || !email || !phone || !checkIn}
              className="flex-2 flex-1 rounded-xl py-3 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#1B4F72' }}
            >
              {submitting
                ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Processing…</span>
                : 'Confirm Booking'
              }
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Success */}
      {step === 'success' && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center space-y-4">
          <div className="flex justify-center">
            <CheckCircle className="h-14 w-14 text-green-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Booking Confirmed!</h2>
            <p className="mt-1 text-gray-500">Your room has been reserved. Check your email for details.</p>
          </div>
          <div className="rounded-xl bg-white border border-green-200 px-6 py-4 inline-block mx-auto">
            <p className="text-xs text-gray-400 uppercase tracking-widest">Booking Reference</p>
            <p className="font-mono font-bold text-xl text-[#1B4F72] mt-1">{bookingRef}</p>
          </div>
          {amount > 0 && (
            <p className="text-sm text-gray-600">
              Amount due: <strong className="text-[#1B4F72]">{ghs(amount)}</strong>
              <br />
              <span className="text-xs text-gray-400">
                Our team will contact you shortly to arrange payment via MoMo or bank transfer.
              </span>
            </p>
          )}
          <button
            onClick={() => { setStep('room'); setSelected(null); setBookingRef(''); }}
            className="text-sm text-[#1B4F72] underline hover:opacity-75"
          >
            Make another booking
          </button>
        </div>
      )}

      {/* Input styles (injected via className="input") */}
      <style>{`
        .input {
          display: block;
          width: 100%;
          padding: 9px 12px;
          border: 1.5px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          color: #111827;
          outline: none;
          transition: border-color 0.15s;
          background: #fff;
        }
        .input:focus { border-color: #1B4F72; }
        .input::placeholder { color: #9ca3af; }
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
