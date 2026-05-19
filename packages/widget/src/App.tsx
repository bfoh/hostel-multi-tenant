import { h, Fragment } from 'preact'
import { useState, useEffect } from 'preact/hooks'
import type { RoomCategory, BookingResult } from './api'
import { getAvailableRooms, createBooking } from './api'

interface Props {
  slug: string
  onClose?: () => void
}

type Step = 'rooms' | 'details' | 'success'

function ghs(pesewas: number) {
  return 'GH₵ ' + (pesewas / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
}

export function App({ slug, onClose }: Props) {
  const [step, setStep]           = useState<Step>('rooms')
  const [rooms, setRooms]         = useState<RoomCategory[]>([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<RoomCategory | null>(null)
  const [error, setError]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult]       = useState<BookingResult | null>(null)

  // Form fields
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [phone,     setPhone]     = useState('')
  const [studentId, setStudentId] = useState('')
  const [checkIn,   setCheckIn]   = useState('')

  useEffect(() => {
    getAvailableRooms(slug)
      .then(setRooms)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [slug])

  async function handleBook() {
    if (!selected) return
    setError('')
    setSubmitting(true)
    try {
      const res = await createBooking(slug, {
        category_id:    selected.id,
        check_in_date:  checkIn,
        check_out_date: null,
        first_name:     firstName.trim(),
        last_name:      lastName.trim(),
        email:          email.trim() || null,
        phone:          phone.trim(),
        student_id:     studentId.trim() || null,
      })
      setResult(res)
      setStep('success')
    } catch (e: any) {
      setError(e.message ?? 'Booking failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const stepIndex = step === 'rooms' ? 0 : step === 'details' ? 1 : 2

  return (
    <div class="abw-panel">
      <div class="abw-panel-header">
        <span class="abw-panel-title">Book a Room</span>
        {onClose && (
          <button class="abw-close-btn" onClick={onClose} aria-label="Close">×</button>
        )}
      </div>

      <div class="abw-body">
        {step !== 'success' && (
          <div class="abw-steps">
            {[0, 1].map((i) => (
              <div key={i} class={`abw-step${stepIndex > i || stepIndex === i ? ' active' : ''}`} />
            ))}
          </div>
        )}

        {/* Step 1: Room selection */}
        {step === 'rooms' && (
          <>
            {loading && <p style={{ color: '#718096', textAlign: 'center' }}>Loading rooms…</p>}
            {error && <p class="abw-error">{error}</p>}
            {!loading && rooms.length === 0 && !error && (
              <p style={{ color: '#718096', textAlign: 'center' }}>No rooms available at this time.</p>
            )}
            {!loading && rooms.length > 0 && (
              <div class="abw-rooms">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    class={`abw-room-card${selected?.id === room.id ? ' selected' : ''}`}
                    onClick={() => setSelected(room)}
                  >
                    <div class="abw-room-name">{room.name}</div>
                    <div class="abw-room-meta">
                      {capitalise(room.type)} · {room.capacity} {room.capacity === 1 ? 'person' : 'people'}
                    </div>
                    {room.amenities.length > 0 && (
                      <div class="abw-room-meta">{room.amenities.slice(0, 3).join(' · ')}</div>
                    )}
                    <div class="abw-room-price">{ghs(room.base_rate)} / {room.rate_unit}</div>
                    <div class="abw-room-avail">
                      {room.available_count} room{room.available_count !== 1 ? 's' : ''} available
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              class="abw-btn"
              disabled={!selected}
              onClick={() => { setError(''); setStep('details') }}
            >
              Continue
            </button>
          </>
        )}

        {/* Step 2: Guest details */}
        {step === 'details' && selected && (
          <>
            <p style={{ fontSize: 13, color: '#718096', marginBottom: 16 }}>
              Booking: <strong>{selected.name}</strong> — {ghs(selected.base_rate)} / {selected.rate_unit}
            </p>
            <div class="abw-row">
              <div class="abw-field">
                <label class="abw-label">First name *</label>
                <input class="abw-input" value={firstName} onInput={(e: any) => setFirstName(e.target.value)} placeholder="Kwame" />
              </div>
              <div class="abw-field">
                <label class="abw-label">Last name *</label>
                <input class="abw-input" value={lastName} onInput={(e: any) => setLastName(e.target.value)} placeholder="Mensah" />
              </div>
            </div>
            <div class="abw-field">
              <label class="abw-label">Email *</label>
              <input class="abw-input" type="email" value={email} onInput={(e: any) => setEmail(e.target.value)} placeholder="kwame@university.edu.gh" />
            </div>
            <div class="abw-field">
              <label class="abw-label">Phone / MoMo *</label>
              <input class="abw-input" type="tel" value={phone} onInput={(e: any) => setPhone(e.target.value)} placeholder="0244000000" />
            </div>
            <div class="abw-field">
              <label class="abw-label">Student ID (optional)</label>
              <input class="abw-input" value={studentId} onInput={(e: any) => setStudentId(e.target.value)} placeholder="STU-2025-001" />
            </div>
            <div class="abw-field">
              <label class="abw-label">Check-in date *</label>
              <input class="abw-input" type="date" value={checkIn} onInput={(e: any) => setCheckIn(e.target.value)} />
            </div>
            {error && <p class="abw-error">{error}</p>}
            <button
              class="abw-btn"
              disabled={submitting || !firstName || !lastName || !email || !phone || !checkIn}
              onClick={handleBook}
            >
              {submitting ? <span class="abw-spinner" /> : 'Confirm Booking'}
            </button>
            <button class="abw-btn abw-btn-secondary" onClick={() => setStep('rooms')}>
              Back
            </button>
          </>
        )}

        {/* Step 3: Success */}
        {step === 'success' && result && (
          <div class="abw-success">
            <div class="abw-success-icon">🎉</div>
            <div class="abw-success-title">Booking Received!</div>
            <div class="abw-success-ref">Ref: {result.booking_ref}</div>
            {result.payment ? (
              <>
                <p style={{ marginTop: 12, fontSize: 13, color: '#4a5568' }}>
                  Complete payment of <strong>{ghs(result.payment.amount)}</strong> to confirm your room.
                </p>
                <p style={{ marginTop: 4, fontSize: 12, color: '#718096' }}>
                  Mobile Money · Card · Bank Transfer
                </p>
                <a
                  href={result.payment.authorization_url}
                  target="_top"
                  rel="noopener noreferrer"
                  class="abw-btn"
                  style={{ marginTop: 20, display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}
                >
                  Pay {ghs(result.payment.amount)} now
                </a>
              </>
            ) : (
              <p style={{ marginTop: 12, fontSize: 13, color: '#4a5568' }}>
                We'll contact you shortly to complete payment of <strong>{ghs(result.amount)}</strong>.
              </p>
            )}
            {onClose && (
              <button class="abw-btn abw-btn-secondary" style={{ marginTop: 12 }} onClick={onClose}>Close</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
