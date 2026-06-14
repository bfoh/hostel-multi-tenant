'use client'

import { useState } from 'react'
import { Key, Plus, Loader2, RotateCcw, AlertTriangle, Trash2 } from 'lucide-react'

interface RoomKey {
  id: string
  key_label: string
  key_type: string
  status: string
  issued_at?: string | null
  returned_at?: string | null
  notes?: string | null
  rooms?: { room_number: string; block?: string } | null
  bookings?: { booking_ref: string } | null
  occupants?: { first_name: string; last_name: string } | null
}

interface Room { id: string; room_number: string; block?: string | null }

const STATUS_STYLES: Record<string, string> = {
  available: 'bg-success-subtle text-success border-success/20',
  issued:    'bg-brand-subtle text-brand border-brand/20',
  lost:      'bg-danger-subtle text-danger border-danger/20',
  damaged:   'bg-warning-subtle text-warning-fg border-warning/20',
  retired:   'bg-surface-sunken text-text-tertiary border-border',
}

export function KeysClient({ initialKeys, rooms }: { initialKeys: RoomKey[]; rooms: Room[] }) {
  const [keys, setKeys] = useState(initialKeys)
  const [filter, setFilter] = useState('all')
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError]   = useState<string | null>(null)

  // Add key form
  const [showAdd, setShowAdd]     = useState(false)
  const [roomId, setRoomId]       = useState(rooms[0]?.id ?? '')
  const [keyLabel, setKeyLabel]   = useState('Key A')
  const [keyType, setKeyType]     = useState('physical')
  const [addNotes, setAddNotes]   = useState('')
  const [adding, setAdding]       = useState(false)
  const [addError, setAddError]   = useState<string | null>(null)

  const displayed = filter === 'all' ? keys : keys.filter((k) => k.status === filter)

  async function action(keyId: string, actionName: string) {
    setSaving(keyId); setError(null)
    try {
      const res = await fetch(`/api/keys/${keyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setKeys((prev) => prev.map((k) => k.id === keyId ? data : k))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(null)
    }
  }

  async function remove(keyId: string) {
    setSaving(keyId); setError(null)
    try {
      await fetch(`/api/keys/${keyId}`, { method: 'DELETE' })
      setKeys((prev) => prev.filter((k) => k.id !== keyId))
    } finally {
      setSaving(null)
    }
  }

  async function addKey() {
    if (!roomId) { setAddError('Select a room'); return }
    if (!keyLabel.trim()) { setAddError('Key label required'); return }
    setAdding(true); setAddError(null)
    try {
      const res = await fetch(`/api/rooms/${roomId}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_label: keyLabel.trim(), key_type: keyType, notes: addNotes || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setKeys((prev) => [data, ...prev])
      setShowAdd(false)
      setKeyLabel('Key A'); setKeyType('physical'); setAddNotes('')
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setAdding(false)
    }
  }

  const overdueCount = keys.filter((k) => k.status === 'issued' && k.issued_at && (Date.now() - new Date(k.issued_at).getTime()) > 90 * 86400000).length

  return (
    <div className="space-y-4">
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-warning/20 bg-warning-subtle px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
          <p className="text-sm text-warning-fg font-medium">
            {overdueCount} key{overdueCount > 1 ? 's' : ''} issued for over 90 days — follow up on return
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-border bg-surface-sunken p-1">
          {['all', 'available', 'issued', 'lost', 'damaged'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors capitalize ${filter === s ? 'bg-surface shadow-sm text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowAdd((p) => !p)}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors"
        >
          <Plus className="h-4 w-4" /> Add key
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <p className="text-sm font-medium text-text-primary">Add new key</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-text-tertiary">Room</label>
              <select
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              >
                {rooms.map((r) => <option key={r.id} value={r.id}>Room {r.room_number}{r.block ? ` · Blk ${r.block}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-tertiary">Label</label>
              <input
                value={keyLabel}
                onChange={(e) => setKeyLabel(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-tertiary">Type</label>
              <select
                value={keyType}
                onChange={(e) => setKeyType(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="physical">Physical</option>
                <option value="card">Card</option>
                <option value="fob">Fob</option>
              </select>
            </div>
          </div>
          <input
            value={addNotes}
            onChange={(e) => setAddNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
          />
          {addError && <p className="text-xs text-danger">{addError}</p>}
          <div className="flex gap-2">
            <button
              onClick={addKey}
              disabled={adding}
              className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover disabled:opacity-60 transition-colors"
            >
              {adding && <Loader2 className="h-4 w-4 animate-spin" />}
              Add key
            </button>
            <button onClick={() => setShowAdd(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface-raised transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Keys table */}
      {displayed.length === 0 ? (
        <p className="py-16 text-center text-sm text-text-tertiary">No keys {filter !== 'all' ? `with status "${filter}"` : ''}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-raised">
                <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Key</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium text-text-tertiary sm:table-cell">Room</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Status</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium text-text-tertiary md:table-cell">Holder</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium text-text-tertiary lg:table-cell">Issued</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayed.map((key) => {
                const room = key.rooms
                const occ  = key.occupants
                const booking = key.bookings
                const isOverdue = key.status === 'issued' && key.issued_at && (Date.now() - new Date(key.issued_at).getTime()) > 90 * 86400000
                return (
                  <tr key={key.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-text-disabled shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-text-primary">{key.key_label}</p>
                          <p className="text-xs text-text-tertiary capitalize">{key.key_type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell text-sm text-text-secondary">
                      {room ? `Room ${room.room_number}${room.block ? ` · Blk ${room.block}` : ''}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[key.status] ?? ''}`}>
                        {key.status}
                        {isOverdue && ' ⚠'}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell text-sm text-text-secondary">
                      {occ ? `${occ.first_name} ${occ.last_name}` : booking ? booking.booking_ref : '—'}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell text-xs text-text-tertiary">
                      {key.issued_at ? new Date(key.issued_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {saving === key.id && <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />}
                        {key.status === 'available' && (
                          <button
                            onClick={() => action(key.id, 'issue')}
                            disabled={saving === key.id}
                            className="rounded px-2 py-1 text-xs text-brand hover:bg-brand-subtle transition-colors disabled:opacity-60"
                          >
                            Issue
                          </button>
                        )}
                        {key.status === 'issued' && (
                          <>
                            <button
                              onClick={() => action(key.id, 'return')}
                              disabled={saving === key.id}
                              className="rounded px-2 py-1 text-xs text-success hover:bg-success-subtle transition-colors disabled:opacity-60"
                            >
                              <RotateCcw className="inline h-3 w-3 mr-0.5" />Return
                            </button>
                            <button
                              onClick={() => action(key.id, 'mark_lost')}
                              disabled={saving === key.id}
                              className="rounded px-2 py-1 text-xs text-danger hover:bg-danger-subtle transition-colors disabled:opacity-60"
                            >
                              Lost
                            </button>
                          </>
                        )}
                        {['available', 'damaged', 'lost'].includes(key.status) && (
                          <button
                            onClick={() => remove(key.id)}
                            disabled={saving === key.id}
                            className="rounded p-1 text-text-tertiary hover:text-danger transition-colors disabled:opacity-60"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
