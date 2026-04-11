'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, CheckCircle, XCircle, Loader2, RotateCcw, Maximize2, Minimize2, UserCircle2 } from 'lucide-react'
import { formatGHS } from '@/lib/utils'

type Phase = 'idle' | 'loading' | 'found' | 'confirming' | 'success' | 'error'

interface BookingResult {
  id: string
  booking_ref: string
  status: string
  check_in_date: string
  check_out_date: string
  final_amount: number
  paid_amount: number
  occupants: { first_name: string; last_name: string; phone?: string; photo_url?: string } | null
  rooms: { room_number: string; block?: string; floor?: number; room_categories: { name: string } | null } | null
}

const ALLOWED_CHECK_IN_STATUSES = ['confirmed', 'pending_payment']

export function KioskClient() {
  const [ref, setRef]       = useState('')
  const [phase, setPhase]   = useState<Phase>('idle')
  const [booking, setBooking] = useState<BookingResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-focus input when idle
  useEffect(() => {
    if (phase === 'idle') inputRef.current?.focus()
  }, [phase])

  // Auto-reset after success/error
  useEffect(() => {
    if (phase === 'success' || phase === 'error') {
      resetTimer.current = setTimeout(reset, 8000)
    }
    return () => { if (resetTimer.current) clearTimeout(resetTimer.current) }
  }, [phase])

  const reset = useCallback(() => {
    setPhase('idle')
    setRef('')
    setBooking(null)
    setErrorMsg('')
  }, [])

  async function lookup() {
    if (!ref.trim()) return
    setPhase('loading')
    try {
      const res = await fetch(`/api/kiosk/lookup?ref=${encodeURIComponent(ref.trim())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Not found')
      setBooking(data)
      setPhase('found')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Booking not found')
      setPhase('error')
    }
  }

  async function checkIn() {
    if (!booking) return
    setPhase('confirming')
    try {
      const res = await fetch('/api/kiosk/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: booking.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Check-in failed')
      setPhase('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Check-in failed')
      setPhase('error')
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setFullscreen(true)
    } else {
      document.exitFullscreen()
      setFullscreen(false)
    }
  }

  const occ  = booking?.occupants
  const room = booking?.rooms
  const cat  = room?.room_categories

  return (
    <div className="min-h-screen bg-surface-sunken flex flex-col">
      {/* ── Top bar ──────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
        <div>
          <h1 className="text-lg font-bold text-text-primary">Reception Kiosk</h1>
          <p className="text-xs text-text-tertiary">{new Date().toLocaleDateString('en-GH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-3">
          {phase !== 'idle' && (
            <button onClick={reset} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-raised transition-colors">
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
          )}
          <button onClick={toggleFullscreen} className="rounded-lg border border-border p-2 text-text-secondary hover:bg-surface-raised transition-colors">
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────────── */}
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">

          {/* ── IDLE — search form ─────────────────────────────── */}
          {phase === 'idle' && (
            <div className="rounded-2xl border border-border bg-surface p-8 space-y-6 shadow-sm">
              <div className="text-center space-y-2">
                <UserCircle2 className="mx-auto h-16 w-16 text-text-disabled" />
                <h2 className="text-xl font-bold text-text-primary">Welcome</h2>
                <p className="text-sm text-text-secondary">Enter your booking reference to check in</p>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); lookup() }} className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-disabled" />
                  <input
                    ref={inputRef}
                    value={ref}
                    onChange={(e) => setRef(e.target.value.toUpperCase())}
                    placeholder="e.g. BK-2024-001"
                    className="w-full rounded-xl border border-border bg-surface-raised pl-10 pr-4 py-3 text-center text-lg font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-brand uppercase placeholder:normal-case placeholder:tracking-normal placeholder:text-sm placeholder:font-sans"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!ref.trim()}
                  className="w-full rounded-xl bg-brand py-3 text-base font-semibold text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-50"
                >
                  Find Booking
                </button>
              </form>
            </div>
          )}

          {/* ── LOADING ─────────────────────────────────────────── */}
          {phase === 'loading' && (
            <div className="rounded-2xl border border-border bg-surface p-12 text-center shadow-sm space-y-4">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand" />
              <p className="text-lg font-medium text-text-primary">Looking up booking…</p>
            </div>
          )}

          {/* ── FOUND — booking card ─────────────────────────────── */}
          {phase === 'found' && booking && (
            <div className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden space-y-0">
              {/* Header */}
              <div className="bg-brand px-6 py-5 text-brand-fg text-center">
                {occ?.photo_url ? (
                  <img src={occ.photo_url} alt="" className="mx-auto h-20 w-20 rounded-full object-cover border-4 border-white/30 mb-3" />
                ) : (
                  <div className="mx-auto h-20 w-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold mb-3">
                    {occ ? occ.first_name[0] + occ.last_name[0] : '?'}
                  </div>
                )}
                <h2 className="text-2xl font-bold">
                  {occ ? `${occ.first_name} ${occ.last_name}` : 'Unknown'}
                </h2>
                <p className="text-sm text-white/70 font-mono mt-0.5">{booking.booking_ref}</p>
              </div>

              {/* Details */}
              <div className="px-6 py-5 space-y-3">
                <Row label="Room">
                  {room ? `Room ${room.room_number}${room.block ? ` · Block ${room.block}` : ''}${room.floor != null ? ` · Floor ${room.floor}` : ''}` : '—'}
                  {cat ? ` · ${cat.name}` : ''}
                </Row>
                <Row label="Check-in date">{booking.check_in_date}</Row>
                <Row label="Check-out date">{booking.check_out_date}</Row>
                <Row label="Balance due">
                  <span className={booking.final_amount - booking.paid_amount > 0 ? 'text-danger font-semibold' : 'text-success font-semibold'}>
                    {formatGHS(booking.final_amount - booking.paid_amount)}
                  </span>
                </Row>
                <Row label="Status">
                  <span className="capitalize">{booking.status.replace('_', ' ')}</span>
                </Row>
              </div>

              {/* Actions */}
              <div className="border-t border-border px-6 py-4 space-y-3">
                {ALLOWED_CHECK_IN_STATUSES.includes(booking.status) ? (
                  <button
                    onClick={checkIn}
                    className="w-full rounded-xl bg-success py-3 text-base font-semibold text-white hover:bg-success/90 transition-colors"
                  >
                    Confirm Check-In
                  </button>
                ) : (
                  <div className="rounded-lg bg-warning-subtle border border-warning/20 px-4 py-3 text-center text-sm text-warning-fg">
                    This booking cannot be checked in (status: {booking.status.replace('_', ' ')})
                  </div>
                )}
                <button
                  onClick={reset}
                  className="w-full rounded-xl border border-border py-2.5 text-sm text-text-secondary hover:bg-surface-raised transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── CONFIRMING ───────────────────────────────────────── */}
          {phase === 'confirming' && (
            <div className="rounded-2xl border border-border bg-surface p-12 text-center shadow-sm space-y-4">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-success" />
              <p className="text-lg font-medium text-text-primary">Checking in…</p>
            </div>
          )}

          {/* ── SUCCESS ─────────────────────────────────────────── */}
          {phase === 'success' && booking && (
            <div className="rounded-2xl border border-success/30 bg-success-subtle p-8 text-center shadow-sm space-y-4">
              <CheckCircle className="mx-auto h-20 w-20 text-success" />
              <div>
                <h2 className="text-2xl font-bold text-success">Welcome!</h2>
                <p className="text-lg font-semibold text-text-primary mt-1">
                  {occ ? `${occ.first_name} ${occ.last_name}` : ''}
                </p>
                {room && (
                  <p className="text-sm text-text-secondary mt-1">
                    Room {room.room_number}{room.block ? ` · Block ${room.block}` : ''}
                  </p>
                )}
              </div>
              <p className="text-xs text-text-tertiary">This screen will reset in 8 seconds</p>
              <button onClick={reset} className="rounded-xl border border-border px-6 py-2 text-sm text-text-secondary hover:bg-surface transition-colors">
                Done
              </button>
            </div>
          )}

          {/* ── ERROR ───────────────────────────────────────────── */}
          {phase === 'error' && (
            <div className="rounded-2xl border border-danger/30 bg-danger-subtle p-8 text-center shadow-sm space-y-4">
              <XCircle className="mx-auto h-20 w-20 text-danger" />
              <div>
                <h2 className="text-xl font-bold text-danger">Error</h2>
                <p className="text-sm text-text-secondary mt-1">{errorMsg}</p>
              </div>
              <p className="text-xs text-text-tertiary">This screen will reset in 8 seconds</p>
              <button onClick={reset} className="rounded-xl border border-border px-6 py-2 text-sm text-text-secondary hover:bg-surface transition-colors">
                Try again
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-text-tertiary">{label}</span>
      <span className="font-medium text-text-primary text-right">{children}</span>
    </div>
  )
}
