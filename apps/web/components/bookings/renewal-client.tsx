'use client'

import { useState } from 'react'
import { RefreshCw, Loader2, Bell, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { formatGHS } from '@/lib/utils'

interface Booking {
  id: string; booking_ref: string; status: string
  check_in_date: string; check_out_date: string
  rate_per_unit: number; rate_unit: string
  final_amount: number; paid_amount: number
  occupants: any; rooms: any
}

function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
}

function urgency(days: number) {
  if (days <= 7)  return { cls: 'bg-danger-subtle text-danger border-danger/20',   label: `${days}d` }
  if (days <= 14) return { cls: 'bg-warning-subtle text-warning-fg border-warning/20', label: `${days}d` }
  return           { cls: 'bg-surface-sunken text-text-secondary border-border',    label: `${days}d` }
}

export function RenewalClient({ initialBookings }: { initialBookings: Booking[] }) {
  const [bookings, setBookings] = useState(initialBookings)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [renewingId, setRenewingId] = useState<string | null>(null)
  const [newDate, setNewDate]   = useState('')
  const [notes, setNotes]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [smsId, setSmsId]       = useState<string | null>(null)

  async function renew(bookingId: string) {
    if (!newDate) { setError('Select a new check-out date'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_check_out_date: newDate, notes: notes || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setBookings((prev) => prev.filter((b) => b.id !== bookingId))
      setExpanded(null); setNewDate(''); setNotes('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  async function sendReminder(booking: Booking) {
    setSmsId(booking.id)
    const occ = Array.isArray(booking.occupants) ? booking.occupants[0] : booking.occupants
    try {
      await fetch('/api/communications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target:   'manual',
          channels: { sms: true },
          message:  `Hi ${occ?.first_name ?? 'there'}, your stay at our hostel ends on ${booking.check_out_date}. Please contact us to renew or arrange checkout. Ref: ${booking.booking_ref}`,
          phone_numbers: occ?.phone ? [occ.phone] : [],
        }),
      })
    } finally {
      setSmsId(null)
    }
  }

  if (bookings.length === 0) {
    return <p className="py-16 text-center text-sm text-text-tertiary">No bookings expiring in the next 30 days</p>
  }

  return (
    <div className="space-y-3">
      {bookings.map((b) => {
        const occ    = Array.isArray(b.occupants) ? b.occupants[0] : b.occupants
        const room   = Array.isArray(b.rooms) ? b.rooms[0] : b.rooms
        const cat    = room ? (Array.isArray(room.room_categories) ? room.room_categories[0] : room.room_categories) : null
        const days   = daysUntil(b.check_out_date)
        const urg    = urgency(days)
        const isOpen = expanded === b.id

        return (
          <div key={b.id} className="rounded-xl border border-border bg-surface overflow-hidden">
            <button
              onClick={() => { setExpanded(isOpen ? null : b.id); setError(null) }}
              className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-surface-raised transition-colors"
            >
              <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-bold ${urg.cls}`}>{urg.label}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="ref-number text-xs text-text-disabled">{b.booking_ref}</p>
                  <span className="text-xs text-text-tertiary capitalize">{b.status.replace('_', ' ')}</span>
                </div>
                <p className="text-sm font-medium text-text-primary">
                  {occ ? `${occ.first_name} ${occ.last_name}` : '—'}
                  {room ? ` · Room ${room.room_number}` : ''}
                  {cat ? ` · ${cat.name}` : ''}
                </p>
                <p className="text-xs text-text-tertiary">
                  {b.check_in_date} → <span className="font-medium">{b.check_out_date}</span>
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); sendReminder(b) }}
                  disabled={smsId === b.id}
                  title="Send SMS reminder"
                  className="rounded-md p-1.5 text-text-tertiary hover:text-brand transition-colors"
                >
                  {smsId === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                </button>
                <Link
                  href={`/bookings/${b.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-brand hover:underline"
                >
                  View
                </Link>
                {isOpen ? <ChevronUp className="h-4 w-4 text-text-tertiary" /> : <ChevronDown className="h-4 w-4 text-text-tertiary" />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-border bg-surface-raised px-4 py-4 space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Balance due</span>
                  <span className={`font-semibold ${b.final_amount - b.paid_amount > 0 ? 'text-danger' : 'text-success'}`}>
                    {formatGHS(b.final_amount - b.paid_amount)}
                  </span>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-medium text-text-tertiary">Extend stay to</p>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <input
                        type="date"
                        value={newDate}
                        min={b.check_out_date}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                    </div>
                    <button
                      onClick={() => renew(b.id)}
                      disabled={saving || !newDate}
                      className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60"
                    >
                      {saving && renewingId === b.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <RefreshCw className="h-4 w-4" />}
                      Renew
                    </button>
                  </div>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                  {error && <p className="text-xs text-danger">{error}</p>}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
