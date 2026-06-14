import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, BedDouble } from 'lucide-react'

import { getRoomsWithCurrentBooking } from '@/lib/data/rooms'
import { RoomsGrid, type RoomCardData } from '@/components/rooms/rooms-grid'

export const metadata: Metadata = { title: 'Rooms' }

export default async function RoomsPage() {
  const rooms = await getRoomsWithCurrentBooking()

  const summary = {
    total:       rooms.length,
    available:   rooms.filter((r) => r.effectiveStatus === 'available' || r.effectiveStatus === 'partial').length,
    occupied:    rooms.filter((r) => r.effectiveStatus === 'occupied').length,
    maintenance: rooms.filter((r) => r.effectiveStatus === 'maintenance').length,
  }

  const cards: RoomCardData[] = rooms.map((room) => {
    const category = Array.isArray(room.category) ? room.category[0] : room.category
    const occupant = room.activeBooking
      ? Array.isArray(room.activeBooking.occupant)
        ? room.activeBooking.occupant[0]
        : room.activeBooking.occupant
      : null
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
      occupantName:        occupant ? `${occupant.first_name} ${occupant.last_name}` : null,
      occupantPhone:       occupant?.phone ?? null,
    }
  })

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
      {rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <BedDouble className="h-10 w-10 text-text-disabled" />
          <div>
            <p className="font-medium text-text-primary">No rooms yet</p>
            <p className="mt-0.5 text-sm text-text-secondary">
              Add your first room to start managing occupancy.
            </p>
          </div>
          <Link
            href="/rooms/new"
            className="mt-2 flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add first room
          </Link>
        </div>
      ) : (
        <RoomsGrid rooms={cards} />
      )}
    </div>
  )
}
