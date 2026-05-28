import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, Users, Search, Upload } from 'lucide-react'

import { getOccupants } from '@/lib/data/occupants'
import { OccupantsTable, type OccupantRow } from '@/components/occupants/occupants-table'

export const metadata: Metadata = { title: 'Occupants' }

export default async function OccupantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const occupants = await getOccupants(q)

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Occupants</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {occupants.length} resident{occupants.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/occupants/id-verification"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-raised transition-colors whitespace-nowrap"
          >
            ID Verification
          </Link>
          <Link
            href="/occupants/bulk-import"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-raised transition-colors whitespace-nowrap"
          >
            <Upload className="h-4 w-4" />
            Import
          </Link>
          <Link
            href="/occupants/new"
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity whitespace-nowrap shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add occupant
          </Link>
        </div>
      </div>

      {/* ── Search ───────────────────────────────────────────────── */}
      <form method="get" className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-disabled" />
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search by name, phone, student ID…"
          className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-colors sm:max-w-sm"
        />
      </form>

      {/* ── Table ────────────────────────────────────────────────── */}
      {occupants.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <Users className="h-10 w-10 text-text-disabled" />
          <div>
            <p className="font-medium text-text-primary">
              {q ? 'No occupants match your search' : 'No occupants yet'}
            </p>
            {!q && (
              <p className="mt-0.5 text-sm text-text-secondary">
                Add your first occupant to start managing residents.
              </p>
            )}
          </div>
          {!q && (
            <Link
              href="/occupants/new"
              className="mt-2 flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Add first occupant
            </Link>
          )}
        </div>
      ) : (
        <OccupantsTable
          occupants={occupants.map((o): OccupantRow => {
            // Pick the most relevant booking with a room:
            // checked_in > confirmed > pending_payment, prefer one that
            // covers today, then latest check_in_date.
            const STATUS_RANK: Record<string, number> = {
              checked_in: 0, confirmed: 1, pending_payment: 2,
            }
            const today = new Date().toISOString().slice(0, 10)
            const bookings = (Array.isArray(o.bookings) ? o.bookings : [])
              .filter((b) => STATUS_RANK[b.status] !== undefined && b.room)

            const activeBooking = bookings.sort((a, b) => {
              const ra = STATUS_RANK[a.status] ?? 99
              const rb = STATUS_RANK[b.status] ?? 99
              if (ra !== rb) return ra - rb
              const aCovers = a.check_in_date <= today && a.check_out_date > today ? 0 : 1
              const bCovers = b.check_in_date <= today && b.check_out_date > today ? 0 : 1
              if (aCovers !== bCovers) return aCovers - bCovers
              return b.check_in_date.localeCompare(a.check_in_date)
            })[0]

            const room = activeBooking?.room
              ? Array.isArray(activeBooking.room) ? activeBooking.room[0] : activeBooking.room
              : null
            return {
              id:          o.id,
              first_name:  o.first_name,
              last_name:   o.last_name,
              photo_url:   o.photo_url ?? null,
              student_id:  o.student_id ?? null,
              phone:       o.phone ?? null,
              institution: o.institution ?? null,
              status:      o.status,
              roomLabel:   room ? `Room ${room.room_number}` : null,
            }
          })}
        />
      )}
    </div>
  )
}
