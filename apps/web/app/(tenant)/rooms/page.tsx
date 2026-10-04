import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, BedDouble, Search } from 'lucide-react'

import { getRoomsWithCurrentBooking } from '@/lib/data/rooms'
import { RoomsGrid, type RoomCardData } from '@/components/rooms/rooms-grid'
import { ListPagination } from '@/components/ui/list-pagination'
import { normalisePage, paginateRows } from '@/lib/data/listing'

export const metadata: Metadata = { title: 'Rooms' }

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { q = '', page: pageParam } = await searchParams
  const rooms = await getRoomsWithCurrentBooking()

  const summary = {
    total:       rooms.length,
    available:   rooms.filter((r) => r.effectiveStatus === 'available' || r.effectiveStatus === 'partial').length,
    occupied:    rooms.filter((r) => r.effectiveStatus === 'occupied').length,
    maintenance: rooms.filter((r) => r.effectiveStatus === 'maintenance').length,
  }

  const cards: RoomCardData[] = rooms.map((room) => {
    const category = Array.isArray(room.category) ? room.category[0] : room.category
    const occupants = room.activeBookings.flatMap((booking: any) => {
      const occupant = Array.isArray(booking.occupant)
        ? booking.occupant[0]
        : booking.occupant

      if (!occupant) return []

      const name = `${occupant.first_name ?? ''} ${occupant.last_name ?? ''}`.trim()

      return [{
        bookingId: booking.id,
        name: name || 'Unnamed occupant',
        phone: occupant.phone ?? null,
      }]
    }).sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

    return {
      id:                  room.id,
      room_number:         room.room_number,
      block:               room.block,
      floor:               room.floor ?? null,
      effectiveStatus:     room.effectiveStatus,
      bedsTaken:           room.bedsTaken,
      capacity:            room.capacity,
      housekeeping_status: room.housekeeping_status,
      categoryName:        category?.name ?? null,
      categoryRate:        category?.base_rate ?? null,
      categoryRateUnit:    category?.rate_unit ?? null,
      occupants,
    }
  })
  const query = q.trim().toLowerCase()
  const filteredCards = query
    ? cards.filter((room) => [
        room.room_number,
        room.block,
        room.floor == null ? null : String(room.floor),
        room.categoryName,
        ...room.occupants.flatMap((occupant) => [occupant.name, occupant.phone]),
      ].some((value) => value?.toLowerCase().includes(query)))
    : cards
  const paged = paginateRows(filteredCards, normalisePage(pageParam))

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Rooms</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {summary.total} rooms total · {summary.occupied} occupied · {summary.available} available
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/rooms/import"
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-raised transition-colors"
          >
            Import CSV
          </Link>
          <Link
            href="/rooms/categories"
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-raised transition-colors"
          >
            Room types
          </Link>
          <Link
            href="/rooms/new"
            className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add room
          </Link>
        </div>
      </div>

      <form method="get" className="relative max-w-md">
        <Search className="text-text-disabled pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search room, block, occupant, or phone…"
          className="border-border bg-surface text-text-primary placeholder:text-text-disabled focus:border-brand w-full rounded-md border py-2 pl-9 pr-3 text-sm focus:outline-none"
        />
      </form>

      {/* ── Summary bar ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total', value: summary.total, color: 'text-text-primary' },
          { label: 'Available', value: summary.available, color: 'text-success' },
          { label: 'Occupied', value: summary.occupied, color: 'text-brand' },
          { label: 'Maintenance', value: summary.maintenance, color: 'text-danger' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-text-secondary">{s.label}</p>
            <p className={`mt-1 font-display text-2xl font-bold tabular-nums ${s.color}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Room grid ────────────────────────────────────────────── */}
      {paged.rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <BedDouble className="h-10 w-10 text-text-disabled" />
          <div>
            <p className="font-medium text-text-primary">{q ? 'No rooms match your search' : 'No rooms yet'}</p>
            <p className="mt-0.5 text-sm text-text-secondary">
              {q ? 'Try a room number, block, occupant name, or phone number.' : 'Add your first room to start managing occupancy.'}
            </p>
          </div>
          {!q && (
            <Link
              href="/rooms/new"
              className="mt-2 flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add first room
            </Link>
          )}
        </div>
      ) : (
        <>
          <RoomsGrid rooms={paged.rows} />
          <ListPagination
            pathname="/rooms"
            page={paged.page}
            pageSize={paged.pageSize}
            total={paged.total}
            params={{ q }}
          />
        </>
      )}
    </div>
  )
}
