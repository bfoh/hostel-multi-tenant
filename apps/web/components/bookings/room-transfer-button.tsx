'use client'

import { useState, useEffect } from 'react'
import { ArrowLeftRight, Loader2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Room { id: string; room_number: string; block: string | null; status: string; room_categories: any }

export function RoomTransferButton({
  bookingId,
  currentRoomId,
  bookingStatus,
}: {
  bookingId: string
  currentRoomId: string
  bookingStatus: string
}) {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [rooms, setRooms]     = useState<Room[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [selectedRoom, setSelectedRoom] = useState('')
  const [reason, setReason]   = useState('')
  const [error, setError]     = useState<string | null>(null)

  const canTransfer = ['confirmed', 'checked_in'].includes(bookingStatus)

  useEffect(() => {
    if (!open || rooms.length > 0) return
    setLoading(true)
    fetch('/api/transfer/available-rooms')
      .then((r) => r.json())
      .then((data) => setRooms((Array.isArray(data) ? data : []).filter((r: Room) => r.id !== currentRoomId)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, currentRoomId, rooms.length])

  async function transfer() {
    if (!selectedRoom) { setError('Select a room'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_room_id: selectedRoom, reason: reason || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Transfer failed')
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  if (!canTransfer) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-raised transition-colors"
      >
        <ArrowLeftRight className="h-3.5 w-3.5" />
        Transfer room
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold text-text-primary">Transfer to a different room</h2>
              <button onClick={() => setOpen(false)} className="text-text-tertiary hover:text-text-primary">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {loading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-xs text-text-tertiary">New room</label>
                    <select
                      value={selectedRoom}
                      onChange={(e) => setSelectedRoom(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                    >
                      <option value="">Select a room</option>
                      {rooms.map((r) => {
                        const cat = Array.isArray(r.room_categories) ? r.room_categories[0] : r.room_categories
                        return (
                          <option key={r.id} value={r.id}>
                            Room {r.room_number}{r.block ? ` (Block ${r.block})` : ''}{cat ? ` — ${cat.name}` : ''}
                          </option>
                        )
                      })}
                    </select>
                    {rooms.length === 0 && !loading && (
                      <p className="mt-1 text-xs text-text-tertiary">No available rooms found</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-text-tertiary">Reason for transfer (optional)</label>
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Maintenance issue, occupant request"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </div>

                  <p className="rounded-lg bg-warning-subtle px-3 py-2 text-xs text-warning-fg">
                    The booking will be updated to the new room. The rate will be adjusted to match the new room's category rate.
                  </p>

                  {error && <p className="text-xs text-danger">{error}</p>}
                </>
              )}
            </div>

            <div className="flex gap-2 border-t border-border px-6 py-4">
              <button
                onClick={transfer}
                disabled={saving || loading || !selectedRoom}
                className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
                Confirm transfer
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
