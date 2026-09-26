'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatGHS } from '@/lib/utils'

interface Room {
  id: string
  room_number: string
  block: string | null
  category: { id: string; name: string; base_rate: number; rate_unit: string } | { id: string; name: string; base_rate: number; rate_unit: string }[] | null
}

interface Occupant {
  id: string
  first_name: string
  last_name: string
  phone: string
}

interface RoomRow {
  key: string
  room_id: string
  occupant_id: string
}

let rowKeySeq = 0
function newRow(): RoomRow {
  return { key: `row-${++rowKeySeq}`, room_id: '', occupant_id: '' }
}

export function GroupBookingForm({ rooms, occupants, checkIn, checkOut }: {
  rooms: Room[]
  occupants: Occupant[]
  checkIn: string
  checkOut: string
}) {
  const router = useRouter()
  const [rows, setRows] = useState<RoomRow[]>([newRow(), newRow()])
  const [billingName, setBillingName] = useState('')
  const [billingEmail, setBillingEmail] = useState('')
  const [billingPhone, setBillingPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function categoryOf(room: Room) {
    return Array.isArray(room.category) ? room.category[0] : room.category
  }

  function updateRow(key: string, patch: Partial<RoomRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows((prev) => [...prev, newRow()])
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length > 2 ? prev.filter((r) => r.key !== key) : prev))
  }

  const total = rows.reduce((sum, r) => {
    const room = rooms.find((x) => x.id === r.room_id)
    const cat = room ? categoryOf(room) : null
    return sum + (cat?.base_rate ?? 0)
  }, 0)

  async function submit() {
    setError(null)
    if (rows.some((r) => !r.room_id || !r.occupant_id)) {
      setError('Select a room and a guest for every row')
      return
    }
    const roomIds = rows.map((r) => r.room_id)
    if (new Set(roomIds).size !== roomIds.length) {
      setError('Each room can only appear once in a group')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/bookings/group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rooms: rows.map((r) => ({
            occupant_id:    r.occupant_id,
            room_id:        r.room_id,
            check_in_date:  checkIn,
            check_out_date: checkOut,
            source:         'walk_in',
          })),
          billing_contact_name:  billingName || undefined,
          billing_contact_email: billingEmail || undefined,
          billing_contact_phone: billingPhone || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to create group booking')
      router.push(`/bookings/groups/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group booking')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Dates</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-text-tertiary">Check-in</label>
              <input type="date" name="check_in" defaultValue={checkIn} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-tertiary">Check-out</label>
              <input type="date" name="check_out" defaultValue={checkOut} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
            </div>
            <button type="submit" className="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-sunken transition-colors">
              Update availability
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Rooms & Guests</CardTitle></CardHeader>
        <CardContent className="space-y-3 pt-0">
          {rows.map((row, i) => {
            const room = rooms.find((r) => r.id === row.room_id)
            const cat = room ? categoryOf(room) : null
            return (
              <div key={row.key} className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-xs text-text-tertiary">{i + 1}.</span>
                <select
                  value={row.room_id}
                  onChange={(e) => updateRow(row.key, { room_id: e.target.value })}
                  className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value="">Select room…</option>
                  {rooms.map((r) => {
                    const c = categoryOf(r)
                    return (
                      <option key={r.id} value={r.id}>
                        Room {r.room_number}{r.block ? ` (${r.block})` : ''} — {c?.name ?? ''} {c ? `· ${formatGHS(c.base_rate)}` : ''}
                      </option>
                    )
                  })}
                </select>
                <select
                  value={row.occupant_id}
                  onChange={(e) => updateRow(row.key, { occupant_id: e.target.value })}
                  className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value="">Select guest…</option>
                  {occupants.map((o) => (
                    <option key={o.id} value={o.id}>{o.first_name} {o.last_name}{o.phone ? ` — ${o.phone}` : ''}</option>
                  ))}
                </select>
                <span className="w-24 shrink-0 text-right text-sm currency-amount text-text-secondary">
                  {cat ? formatGHS(cat.base_rate) : '—'}
                </span>
                <button
                  onClick={() => removeRow(row.key)}
                  disabled={rows.length <= 2}
                  className="text-text-tertiary hover:text-danger disabled:opacity-30"
                  aria-label="Remove room"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )
          })}

          <button
            onClick={addRow}
            className="flex items-center gap-1.5 text-sm text-brand hover:underline"
          >
            <Plus className="h-4 w-4" /> Add another room
          </button>

          <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
            <span className="text-text-tertiary">Group total</span>
            <span className="currency-amount font-semibold text-text-primary">{formatGHS(total)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Billing Contact</CardTitle></CardHeader>
        <CardContent className="space-y-3 pt-0">
          <p className="text-xs text-text-tertiary">Who should receive the group confirmation and combined invoice?</p>
          <input
            placeholder="Contact name"
            value={billingName}
            onChange={(e) => setBillingName(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="email"
              placeholder="Email"
              value={billingEmail}
              onChange={(e) => setBillingEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <input
              placeholder="Phone"
              value={billingPhone}
              onChange={(e) => setBillingPhone(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        onClick={submit}
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Create group booking
      </button>
    </div>
  )
}
