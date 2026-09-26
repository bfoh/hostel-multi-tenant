'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, Loader2 } from 'lucide-react'
import { formatGHS } from '@/lib/utils'

interface AlternativeRoom {
  id: string
  room_number: string
  block: string | null
  category: { name: string; base_rate: number } | { name: string; base_rate: number }[] | null
}

/**
 * Extend-stay UX with an availability pre-check — hotel-only, calls the
 * dedicated /api/bookings/[id]/extend-stay route (kept separate from the
 * shared /renew route both verticals already use, so this change can't
 * affect hostel tenants). Offers alternative rooms instead of a hard
 * failure when the current room is booked for the requested dates.
 */
export function ExtendStayCard({ bookingId, currentCheckOut, status }: {
  bookingId: string
  currentCheckOut: string
  status: string
}) {
  const router = useRouter()
  const [newDate, setNewDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alternatives, setAlternatives] = useState<AlternativeRoom[] | null>(null)

  if (!['confirmed', 'checked_in'].includes(status)) return null

  async function submit(newRoomId?: string) {
    if (!newDate) { setError('Select a new check-out date'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/extend-stay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_check_out_date: newDate, new_room_id: newRoomId }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409 && Array.isArray(data.alternativeRooms)) {
          setAlternatives(data.alternativeRooms)
          setError(data.error)
          return
        }
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to extend stay')
      }
      setAlternatives(null)
      setNewDate('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extend stay')
    } finally {
      setSaving(false)
    }
  }

  function categoryOf(room: AlternativeRoom) {
    return Array.isArray(room.category) ? room.category[0] : room.category
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-text-tertiary">New check-out date</label>
          <input
            type="date"
            value={newDate}
            min={currentCheckOut}
            onChange={(e) => { setNewDate(e.target.value); setAlternatives(null); setError(null) }}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <button
          onClick={() => submit()}
          disabled={saving || !newDate}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
          Extend
        </button>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      {alternatives && (
        <div className="space-y-2 rounded-lg border border-border bg-surface-raised p-3">
          <p className="text-xs font-medium text-text-tertiary">
            {alternatives.length > 0 ? 'Available rooms for these dates' : 'No other rooms are free for these dates'}
          </p>
          {alternatives.map((r) => {
            const cat = categoryOf(r)
            return (
              <button
                key={r.id}
                onClick={() => submit(r.id)}
                disabled={saving}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:border-brand/40 transition-colors disabled:opacity-60"
              >
                <span>Room {r.room_number}{r.block ? ` (${r.block})` : ''} {cat ? `— ${cat.name}` : ''}</span>
                {cat && <span className="currency-amount text-text-secondary">{formatGHS(cat.base_rate)}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
