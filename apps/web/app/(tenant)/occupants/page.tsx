import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, Users, Search, Pencil, Upload } from 'lucide-react'

import { getOccupants } from '@/lib/data/occupants'
import { initials } from '@/lib/utils'
import { DeleteOccupantButton } from '@/components/occupants/delete-occupant-button'

export const metadata: Metadata = { title: 'Occupants' }

const STATUS_STYLES: Record<string, string> = {
  active:      'bg-success-subtle text-success border-success/20',
  pending:     'bg-warning-subtle text-warning-fg border-warning/20',
  checked_out: 'bg-surface-sunken text-text-secondary border-border',
  suspended:   'bg-danger-subtle text-danger border-danger/20',
  blacklisted: 'bg-danger-subtle text-danger border-danger/20',
}

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
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Phone</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium text-text-tertiary sm:table-cell">Institution</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium text-text-tertiary lg:table-cell">Status</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium text-text-tertiary xl:table-cell">Room</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {occupants.map((o) => {
                const activeBooking = (Array.isArray(o.bookings) ? o.bookings : []).find(
                  (b) => b.status === 'checked_in'
                )
                const room = activeBooking?.room
                  ? Array.isArray(activeBooking.room) ? activeBooking.room[0] : activeBooking.room
                  : null

                return (
                  <tr key={o.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/occupants/${o.id}`} className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand">
                          {o.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={o.photo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            initials(`${o.first_name} ${o.last_name}`)
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text-primary hover:text-brand transition-colors">
                            {o.first_name} {o.last_name}
                          </p>
                          {o.student_id && (
                            <p className="ref-number text-[11px] text-text-tertiary">{o.student_id}</p>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{o.phone}</td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <p className="truncate text-sm text-text-secondary">{o.institution ?? '—'}</p>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${
                          STATUS_STYLES[o.status] ?? 'bg-surface-sunken text-text-secondary border-border'
                        }`}
                      >
                        {o.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 xl:table-cell text-sm text-text-secondary">
                      {room ? `Room ${room.room_number}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/occupants/${o.id}/edit`}
                          title="Edit occupant"
                          className="rounded p-1.5 text-text-disabled hover:text-brand hover:bg-brand/10 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                        <DeleteOccupantButton
                          occupantId={o.id}
                          occupantName={`${o.first_name} ${o.last_name}`}
                        />
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
