'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2, X, CheckSquare, Phone, UsersRound } from 'lucide-react'

import { formatGHS } from '@/lib/utils'
import { DeleteRoomButton } from '@/components/rooms/delete-room-button'

interface RoomOccupantSummary {
  bookingId: string
  name:      string
  phone:     string | null
}

export interface RoomCardData {
  id:                 string
  room_number:        string
  block:              string | null
  floor:              number | null
  effectiveStatus:    string
  bedsTaken:          number
  capacity:           number
  housekeeping_status:string
  categoryName:       string | null
  categoryRate:       number | null
  categoryRateUnit:   string | null
  occupants:          RoomOccupantSummary[]
}

const ROOM_STATUS_STYLES: Record<string, string> = {
  available:   'bg-success-subtle text-success border-success/20',
  partial:     'bg-warning-subtle text-warning-fg border-warning/20',
  occupied:    'bg-brand-subtle text-brand border-brand/20',
  reserved:    'bg-warning-subtle text-warning-fg border-warning/20',
  maintenance: 'bg-danger-subtle text-danger border-danger/20',
  blocked:     'bg-surface-sunken text-text-disabled border-border',
}
const HK_STATUS_STYLES: Record<string, string> = {
  clean:       'text-success',
  dirty:       'text-warning',
  inspecting:  'text-info',
  out_of_order:'text-danger',
}

function occupantInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function RoomsGrid({ rooms }: { rooms: RoomCardData[] }) {
  const router = useRouter()
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [busy, setBusy]             = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const allSelected = selected.size === rooms.length && rooms.length > 0

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rooms.map((r) => r.id)))
  }
  function exitSelect() {
    setSelectMode(false)
    setSelected(new Set())
    setError(null)
  }

  async function bulkDelete() {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} room${selected.size === 1 ? '' : 's'}? Rooms with bookings are skipped.`)) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/rooms/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? `Failed (${res.status})`); setBusy(false); return }
      if (data.blocked > 0) {
        setError(`${data.deleted} deleted · ${data.blocked} skipped (have bookings)`)
      }
      setSelected(new Set())
      setSelectMode(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const selectionBar = !selectMode ? (
    <button
      type="button"
      onClick={() => setSelectMode(true)}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
    >
      <CheckSquare className="h-4 w-4" />
      Select
    </button>
  ) : (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={toggleAll}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
      >
        {allSelected ? 'Clear all' : 'Select all'}
      </button>
      <button
        type="button"
        onClick={bulkDelete}
        disabled={busy || selected.size === 0}
        className="inline-flex items-center gap-1.5 rounded-md bg-danger px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Delete{selected.size > 0 ? ` (${selected.size})` : ''}
      </button>
      <button
        type="button"
        onClick={exitSelect}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
      >
        <X className="h-4 w-4" />
        Cancel
      </button>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        {selectMode && selected.size > 0 ? (
          <p className="text-sm text-text-secondary">{selected.size} selected</p>
        ) : <span />}
        {selectionBar}
      </div>

      {error && (
        <div className="rounded-lg border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning-fg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rooms.map((room) => {
          const isSel = selected.has(room.id)
          const card = (
            <div
              className={`group relative flex h-full flex-col rounded-xl border bg-surface p-4 transition-all ${
                selectMode
                  ? isSel
                    ? 'border-brand ring-2 ring-brand/30'
                    : 'border-border hover:border-brand/40'
                  : 'border-border hover:border-brand/40 hover:shadow-sm'
              }`}
            >
              {selectMode && (
                <div className="absolute left-3 top-3 z-10">
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggle(room.id)}
                    className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                  />
                </div>
              )}

              <div className={`flex items-start justify-between ${selectMode ? 'pl-7' : ''}`}>
                <div>
                  <p className="font-display text-lg font-bold text-text-primary">
                    Room {room.room_number}
                  </p>
                  {(room.block || room.floor != null) && (
                    <p className="text-xs text-text-tertiary">
                      {[room.block && `Block ${room.block}`, room.floor != null && `Floor ${room.floor}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {!selectMode && <DeleteRoomButton id={room.id} label={`Room ${room.room_number}`} />}
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                      ROOM_STATUS_STYLES[room.effectiveStatus] ?? 'bg-surface-sunken text-text-secondary border-border'
                    }`}
                  >
                    {room.effectiveStatus === 'partial'
                      ? `${room.bedsTaken}/${room.capacity} filled`
                      : room.effectiveStatus.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {room.categoryName && (
                <p className="mt-2 text-xs font-medium text-text-secondary">{room.categoryName}</p>
              )}

              <div className="mt-3 overflow-hidden rounded-lg border border-border bg-surface-sunken/60">
                <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                    <UsersRound className="h-3.5 w-3.5" />
                    Occupants
                  </span>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold tabular-nums text-text-tertiary ring-1 ring-inset ring-border">
                    {room.occupants.length} of {room.capacity}
                  </span>
                </div>

                {room.occupants.length > 0 ? (
                  <div className="divide-y divide-border">
                    {room.occupants.map((occupant) => (
                      <div key={occupant.bookingId} className="flex items-center gap-2.5 px-3 py-2.5">
                        <span
                          aria-hidden="true"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-[10px] font-bold tracking-wide text-brand ring-1 ring-inset ring-brand/10"
                        >
                          {occupantInitials(occupant.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-text-primary">
                            {occupant.name}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-text-tertiary">
                            <Phone className="h-3 w-3 shrink-0" />
                            <span className="truncate font-mono">
                              {occupant.phone || 'No phone number'}
                            </span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-14 items-center justify-center px-3 py-3 text-center">
                    <p className="text-[11px] text-text-tertiary">No occupants assigned</p>
                  </div>
                )}
              </div>

              <div className="mt-auto flex items-center justify-between pt-3">
                {room.categoryRate != null ? (
                  <p className="currency-amount text-xs font-medium text-text-secondary">
                    {formatGHS(room.categoryRate)}/{room.categoryRateUnit}
                  </p>
                ) : <span />}
                <span className={`text-[11px] capitalize ${HK_STATUS_STYLES[room.housekeeping_status] ?? 'text-text-tertiary'}`}>
                  {room.housekeeping_status.replace('_', ' ')}
                </span>
              </div>
            </div>
          )

          // In select mode the whole card toggles selection; otherwise it links.
          return selectMode ? (
            <button key={room.id} type="button" onClick={() => toggle(room.id)} className="h-full text-left">
              {card}
            </button>
          ) : (
            <Link key={room.id} href={`/rooms/${room.id}`} className="h-full">
              {card}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
