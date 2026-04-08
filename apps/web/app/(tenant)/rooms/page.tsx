import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, BedDouble, Wrench, AlertCircle } from 'lucide-react'

import { getRoomsWithCurrentBooking } from '@/lib/data/rooms'
import { formatGHS } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = { title: 'Rooms' }

const ROOM_STATUS_STYLES: Record<string, string> = {
  available:   'bg-success-subtle text-success border-success/20',
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

export default async function RoomsPage() {
  const rooms = await getRoomsWithCurrentBooking()

  const summary = {
    total:       rooms.length,
    available:   rooms.filter((r) => r.status === 'available').length,
    occupied:    rooms.filter((r) => r.status === 'occupied').length,
    maintenance: rooms.filter((r) => r.status === 'maintenance').length,
  }

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Rooms</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {summary.total} rooms total · {summary.occupied} occupied · {summary.available} available
          </p>
        </div>
        <div className="flex gap-2">
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rooms.map((room) => {
            const category = Array.isArray(room.category) ? room.category[0] : room.category
            const occupant = room.activeBooking
              ? Array.isArray(room.activeBooking.occupant)
                ? room.activeBooking.occupant[0]
                : room.activeBooking.occupant
              : null

            return (
              <Link
                key={room.id}
                href={`/rooms/${room.id}`}
                className="group flex flex-col rounded-xl border border-border bg-surface p-4 hover:border-brand/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between">
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
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                      ROOM_STATUS_STYLES[room.status] ?? 'bg-surface-sunken text-text-secondary border-border'
                    }`}
                  >
                    {room.status.replace('_', ' ')}
                  </span>
                </div>

                {category && (
                  <p className="mt-2 text-xs font-medium text-text-secondary">{category.name}</p>
                )}

                {/* Occupant if occupied */}
                {occupant ? (
                  <div className="mt-3 rounded-lg bg-surface-sunken px-3 py-2">
                    <p className="truncate text-xs font-medium text-text-primary">
                      {occupant.first_name} {occupant.last_name}
                    </p>
                    <p className="text-[11px] text-text-tertiary">{occupant.phone}</p>
                  </div>
                ) : (
                  <div className="mt-3 flex-1" />
                )}

                {/* Rate + HK status */}
                <div className="mt-3 flex items-center justify-between">
                  {category ? (
                    <p className="currency-amount text-xs font-medium text-text-secondary">
                      {formatGHS(category.base_rate)}/{category.rate_unit}
                    </p>
                  ) : (
                    <span />
                  )}
                  <span className={`text-[11px] capitalize ${HK_STATUS_STYLES[room.housekeeping_status] ?? 'text-text-tertiary'}`}>
                    {room.housekeeping_status.replace('_', ' ')}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
