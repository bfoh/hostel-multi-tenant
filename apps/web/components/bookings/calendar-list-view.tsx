'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface CalendarBooking {
  id: string
  bookingRef: string
  guest: string
  status: string
  checkInDate: string
  checkOutDate: string
  roomNumber: string
}

const STATUS_BADGE: Record<string, string> = {
  confirmed:       'bg-brand-subtle text-brand border-brand/20',
  pending_payment: 'bg-warning-subtle text-warning-fg border-warning/20',
  checked_in:      'bg-success-subtle text-success border-success/20',
  checked_out:     'bg-surface-sunken text-text-secondary border-border',
  cancelled:       'bg-danger-subtle text-danger border-danger/20',
  no_show:         'bg-danger-subtle text-danger border-danger/20',
}

const STATUS_OPTIONS = [
  { value: 'all',             label: 'All statuses' },
  { value: 'confirmed',       label: 'Confirmed' },
  { value: 'pending_payment', label: 'Pending payment' },
  { value: 'checked_in',      label: 'Checked in' },
  { value: 'checked_out',     label: 'Checked out' },
]

/**
 * Flat, searchable list view for the occupancy calendar — the one genuinely
 * useful touch worth keeping from AMP Lodge's List view (search + status
 * filter, a "due today" highlight), rebuilt as a self-contained client
 * component receiving the already month-scoped bookings as props.
 */
export function CalendarListView({ bookings, todayStr }: {
  bookings: CalendarBooking[]
  todayStr: string
}) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return bookings
      .filter((b) => status === 'all' || b.status === status)
      .filter((b) => !q || b.guest.toLowerCase().includes(q) || b.roomNumber.toLowerCase().includes(q) || b.bookingRef.toLowerCase().includes(q))
      .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate))
  }, [bookings, query, status])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guest, room, or booking ref…"
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
        >
          {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-secondary">No bookings match this month{query || status !== 'all' ? ' and filters' : ''}.</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-surface">
          {filtered.map((b) => {
            const dueToday = b.checkOutDate === todayStr && b.status === 'checked_in'
            return (
              <Link
                key={b.id}
                href={`/bookings/${b.id}`}
                className={`flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-raised transition-colors ${dueToday ? 'bg-warning-subtle/40' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-text-primary">{b.guest}</p>
                    <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[b.status] ?? 'bg-surface-sunken text-text-secondary border-border'}`}>
                      {b.status.replace(/_/g, ' ')}
                    </span>
                    {dueToday && (
                      <span className="shrink-0 inline-flex items-center rounded-full border border-warning/30 bg-warning-subtle px-2 py-0.5 text-[10px] font-semibold text-warning-fg">
                        Due today
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-text-tertiary">
                    Room {b.roomNumber} · {b.bookingRef}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-text-secondary">
                  <p>{formatDate(b.checkInDate)}</p>
                  <p className="text-text-tertiary">→ {formatDate(b.checkOutDate)}</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
