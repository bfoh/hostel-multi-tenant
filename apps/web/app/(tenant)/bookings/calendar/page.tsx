import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Occupancy Calendar' }

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function isoDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function dayLabel(d: Date) {
  return d.toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric' })
}

/* ── Status colours ──────────────────────────────────────────────────────── */

const STATUS_COLOR: Record<string, string> = {
  confirmed:       'bg-brand/90 text-white',
  pending_payment: 'bg-warning/80 text-white',
  checked_in:      'bg-success/90 text-white',
  checked_out:     'bg-border text-text-secondary',
  cancelled:       'bg-danger/20 text-danger line-through',
  no_show:         'bg-danger/20 text-danger',
}

const STATUS_DOT: Record<string, string> = {
  confirmed:       'bg-brand',
  pending_payment: 'bg-warning',
  checked_in:      'bg-success',
  checked_out:     'bg-text-disabled',
  cancelled:       'bg-danger',
  no_show:         'bg-danger',
}

/* ── Data ────────────────────────────────────────────────────────────────── */

interface RoomRow {
  id: string
  room_number: string
  block: string | null
  category: string
  status: string
}

interface BookingBar {
  id: string
  booking_ref: string
  guest: string
  status: string
  check_in_date: string
  check_out_date: string
  room_id: string
  /** 0-indexed column start within the visible window */
  colStart: number
  /** span (number of day columns) */
  colSpan: number
}

async function getCalendarData(tenantId: string, windowStart: Date, days: number) {
  const supabase    = await createClient()
  const windowEnd   = addDays(windowStart, days - 1)
  const startStr    = isoDate(windowStart)
  const endStr      = isoDate(windowEnd)

  const [{ data: roomsRaw }, { data: bookingsRaw }] = await Promise.all([
    supabase
      .from('rooms')
      .select('id, room_number, block, status, room_categories(name)')
      .eq('tenant_id', tenantId)
      .not('status', 'eq', 'out_of_order')
      .order('room_number'),

    supabase
      .from('bookings')
      .select('id, booking_ref, check_in_date, check_out_date, status, room_id, occupants(first_name, last_name)')
      .eq('tenant_id', tenantId)
      .not('status', 'in', '("cancelled","no_show")')
      .lte('check_in_date', endStr)
      .gte('check_out_date', startStr)
      .order('check_in_date'),
  ])

  const rooms: RoomRow[] = (roomsRaw ?? []).map(r => ({
    id:          r.id,
    room_number: r.room_number,
    block:       r.block ?? null,
    category:    (r.room_categories as any)?.name ?? 'Unknown',
    status:      r.status,
  }))

  const bars: BookingBar[] = (bookingsRaw ?? []).map(b => {
    const occ = Array.isArray(b.occupants) ? b.occupants[0] : b.occupants
    const guest = occ ? `${occ.first_name} ${occ.last_name}` : 'Guest'

    // Clamp to visible window
    const checkIn  = new Date(Math.max(new Date(b.check_in_date).getTime(),  windowStart.getTime()))
    const checkOut = new Date(Math.min(new Date(b.check_out_date).getTime(), windowEnd.getTime()))

    const colStart = Math.round((checkIn.getTime()  - windowStart.getTime()) / 86400000)
    const colSpan  = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime())  / 86400000))

    return {
      id:             b.id,
      booking_ref:    b.booking_ref,
      guest,
      status:         b.status,
      check_in_date:  b.check_in_date,
      check_out_date: b.check_out_date,
      room_id:        b.room_id,
      colStart,
      colSpan,
    }
  })

  return { rooms, bars }
}

/* ── Page ────────────────────────────────────────────────────────────────── */

const DAYS = 14

export default async function OccupancyCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const { from } = await searchParams
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Parse ?from= or default to today
  const windowStart = from
    ? (() => { const d = new Date(from + 'T00:00:00'); return isNaN(d.getTime()) ? today : d })()
    : today

  const prevFrom = isoDate(addDays(windowStart, -DAYS))
  const nextFrom = isoDate(addDays(windowStart, DAYS))
  const dayDates = Array.from({ length: DAYS }, (_, i) => addDays(windowStart, i))

  const headersList = await headers()
  const tenantId    = headersList.get('x-tenant-id') ?? ''

  const { rooms, bars } = await getCalendarData(tenantId, windowStart, DAYS)

  // Group rooms by block
  const blocks = [...new Set(rooms.map(r => r.block ?? 'Main'))].sort()

  // Build a lookup: roomId → bars
  const barsByRoom = new Map<string, BookingBar[]>()
  for (const bar of bars) {
    const list = barsByRoom.get(bar.room_id) ?? []
    list.push(bar)
    barsByRoom.set(bar.room_id, list)
  }

  const todayStr = isoDate(today)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Link href="/bookings" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
            Bookings
          </Link>
          <span className="text-text-disabled">/</span>
          <h1 className="text-xl font-bold text-text-primary">Occupancy Calendar</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/bookings/calendar?from=${prevFrom}`}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-raised transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Link>
          <Link
            href={`/bookings/calendar?from=${isoDate(today)}`}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-surface-raised transition-colors"
          >
            Today
          </Link>
          <Link
            href={`/bookings/calendar?from=${nextFrom}`}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-raised transition-colors"
          >
            Next <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            href="/bookings/new"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> New booking
          </Link>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries({
          confirmed:       'Confirmed',
          checked_in:      'Checked in',
          pending_payment: 'Pending payment',
          checked_out:     'Checked out',
        }).map(([s, label]) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[s]}`} />
            {label}
          </span>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        {rooms.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-text-secondary">No rooms found. Add rooms to see the calendar.</p>
          </div>
        ) : (
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr>
                {/* Room label column */}
                <th className="sticky left-0 z-20 min-w-[120px] border-b border-r border-border bg-surface-raised px-3 py-2 text-left text-xs font-semibold text-text-secondary">
                  Room
                </th>
                {dayDates.map(d => {
                  const ds     = isoDate(d)
                  const isToday = ds === todayStr
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6
                  return (
                    <th
                      key={ds}
                      className={`min-w-[80px] border-b border-r border-border px-1 py-2 text-center font-medium ${
                        isToday
                          ? 'bg-primary/10 text-primary'
                          : isWeekend
                            ? 'bg-surface-sunken text-text-tertiary'
                            : 'bg-surface-raised text-text-secondary'
                      }`}
                    >
                      {dayLabel(d)}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {blocks.map(block => {
                const blockRooms = rooms.filter(r => (r.block ?? 'Main') === block)
                return (
                  <>
                    {/* Block header row */}
                    <tr key={`block-${block}`}>
                      <td
                        colSpan={DAYS + 1}
                        className="border-b border-border bg-surface-sunken px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-text-tertiary"
                      >
                        {block}
                      </td>
                    </tr>

                    {blockRooms.map(room => {
                      const roomBars = barsByRoom.get(room.id) ?? []
                      return (
                        <tr key={room.id} className="group">
                          {/* Room label */}
                          <td className="sticky left-0 z-10 border-b border-r border-border bg-surface px-3 py-0 group-hover:bg-surface-raised transition-colors">
                            <div className="py-2 leading-tight">
                              <p className="font-semibold text-text-primary">{room.room_number}</p>
                              <p className="text-[10px] text-text-tertiary truncate max-w-[100px]">{room.category}</p>
                            </div>
                          </td>

                          {/* Day cells */}
                          {dayDates.map((d, colIdx) => {
                            const ds      = isoDate(d)
                            const isToday = ds === todayStr
                            const isWeekend = d.getDay() === 0 || d.getDay() === 6

                            // Find a booking bar starting on this column
                            const bar = roomBars.find(b => b.colStart === colIdx)
                            // Is this column occupied by a bar that started earlier?
                            const coveredByBar = roomBars.some(
                              b => b.colStart < colIdx && b.colStart + b.colSpan > colIdx
                            )

                            if (coveredByBar) return null // cell consumed by a colspan bar

                            if (bar) {
                              return (
                                <td
                                  key={ds}
                                  colSpan={bar.colSpan}
                                  className="border-b border-r border-border px-0.5 py-0.5"
                                >
                                  <Link
                                    href={`/bookings/${bar.id}`}
                                    className={`flex h-full min-h-[44px] flex-col justify-center rounded px-2 py-1 transition-opacity hover:opacity-80 ${STATUS_COLOR[bar.status] ?? 'bg-border text-text-secondary'}`}
                                    title={`${bar.guest} · ${bar.booking_ref} · ${bar.check_in_date} → ${bar.check_out_date}`}
                                  >
                                    <p className="font-semibold truncate leading-tight">{bar.guest.split(' ')[0]}</p>
                                    <p className="text-[10px] opacity-80 truncate">{bar.booking_ref}</p>
                                  </Link>
                                </td>
                              )
                            }

                            return (
                              <td
                                key={ds}
                                className={`border-b border-r border-border h-[44px] ${
                                  isToday
                                    ? 'bg-primary/5'
                                    : isWeekend
                                      ? 'bg-surface-sunken/60'
                                      : ''
                                }`}
                              >
                                <Link
                                  href={`/bookings/new?room_id=${room.id}&check_in_date=${ds}`}
                                  className="block h-full w-full opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Create booking"
                                >
                                  <span className="flex h-full items-center justify-center text-text-disabled hover:text-primary">
                                    +
                                  </span>
                                </Link>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-text-tertiary text-center">
        Showing {DAYS} days from {windowStart.toLocaleDateString('en-GH', { dateStyle: 'medium' })}.
        Click any booking bar to open it. Click an empty cell to create a booking for that room and date.
      </p>
    </div>
  )
}
