'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X, Plus } from 'lucide-react'
import { formatGHS } from '@/lib/utils'

/* ── Remove a room from the group ─────────────────────────────────────── */

export function RemoveRoomButton({ groupId, bookingId, status }: {
  groupId: string
  bookingId: string
  status: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (['checked_out', 'cancelled'].includes(status)) return null

  async function remove() {
    if (!confirm('Remove this room from the group? This cancels its booking.')) return
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/bookings/group/${groupId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to remove room')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove room')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={remove}
        disabled={busy || status === 'checked_in'}
        className="text-xs text-danger hover:underline disabled:opacity-40"
      >
        {busy ? 'Removing…' : 'Remove'}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )
}

/* ── Edit billing contact ─────────────────────────────────────────────── */

export function BillingContactForm({ groupId, initial }: {
  groupId: string
  initial: { name: string | null; email: string | null; phone: string | null }
}) {
  const router = useRouter()
  const [name, setName] = useState(initial.name ?? '')
  const [email, setEmail] = useState(initial.email ?? '')
  const [phone, setPhone] = useState(initial.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true); setError(null); setSaved(false)
    try {
      const res = await fetch(`/api/bookings/group/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billing_contact_name:  name || null,
          billing_contact_email: email || null,
          billing_contact_phone: phone || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to save')
      setSaved(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <input
        placeholder="Contact name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <input
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {saved ? 'Saved' : 'Save'}
      </button>
    </div>
  )
}

/* ── Add a room to the group ──────────────────────────────────────────── */

interface Room {
  id: string
  room_number: string
  block: string | null
  category: { name: string; base_rate: number } | { name: string; base_rate: number }[] | null
}
interface Occupant {
  id: string
  first_name: string
  last_name: string
  phone: string
}

export function AddRoomForm({ groupId, rooms, occupants, checkIn, checkOut }: {
  groupId: string
  rooms: Room[]
  occupants: Occupant[]
  checkIn: string
  checkOut: string
}) {
  const router = useRouter()
  const [roomId, setRoomId] = useState('')
  const [occupantId, setOccupantId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (rooms.length === 0) {
    return <p className="text-sm text-text-tertiary">No other rooms are available for these dates.</p>
  }

  async function add() {
    if (!roomId || !occupantId) { setError('Select a room and a guest'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/bookings/group/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          occupant_id: occupantId,
          room_id: roomId,
          check_in_date: checkIn,
          check_out_date: checkOut,
          source: 'walk_in',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to add room')
      setRoomId(''); setOccupantId('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add room')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
      >
        <option value="">Select room…</option>
        {rooms.map((r) => {
          const cat = Array.isArray(r.category) ? r.category[0] : r.category
          return (
            <option key={r.id} value={r.id}>
              Room {r.room_number}{r.block ? ` (${r.block})` : ''} {cat ? `— ${cat.name} · ${formatGHS(cat.base_rate)}` : ''}
            </option>
          )
        })}
      </select>
      <select
        value={occupantId}
        onChange={(e) => setOccupantId(e.target.value)}
        className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
      >
        <option value="">Select guest…</option>
        {occupants.map((o) => (
          <option key={o.id} value={o.id}>{o.first_name} {o.last_name}</option>
        ))}
      </select>
      <button
        onClick={add}
        disabled={saving}
        className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Add
      </button>
      {error && <p className="w-full text-xs text-danger">{error}</p>}
    </div>
  )
}

/* ── Cancel the whole group ───────────────────────────────────────────── */

export function CancelGroupButton({ groupId, hasCheckedIn }: {
  groupId: string
  hasCheckedIn: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cancelGroup() {
    if (!confirm('Cancel this entire group booking? Every room still active will be cancelled.')) return
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/bookings/group/${groupId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to cancel group')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel group')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={cancelGroup}
        disabled={busy || hasCheckedIn}
        title={hasCheckedIn ? 'Cannot cancel: at least one guest is checked in' : undefined}
        className="flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger-subtle px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-40"
      >
        <X className="h-4 w-4" />
        {busy ? 'Cancelling…' : 'Cancel group'}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )
}
