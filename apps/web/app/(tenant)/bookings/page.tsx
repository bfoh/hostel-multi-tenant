import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, CalendarCheck } from 'lucide-react'

import { getBookings } from '@/lib/data/bookings'
import { formatGHS, formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Bookings' }

const STATUSES = [
  { value: 'all',             label: 'All' },
  { value: 'pending_payment', label: 'Pending' },
  { value: 'confirmed',       label: 'Confirmed' },
  { value: 'checked_in',      label: 'Checked In' },
  { value: 'checked_out',     label: 'Checked Out' },
  { value: 'cancelled',       label: 'Cancelled' },
]

const STATUS_STYLES: Record<string, string> = {
  pending_payment: 'bg-warning-subtle text-warning-fg border-warning/20',
  confirmed:       'bg-brand-subtle text-brand border-brand/20',
  checked_in:      'bg-success-subtle text-success border-success/20',
  checked_out:     'bg-surface-sunken text-text-secondary border-border',
  cancelled:       'bg-danger-subtle text-danger border-danger/20',
  no_show:         'bg-danger-subtle text-danger border-danger/20',
  enquiry:         'bg-info-subtle text-info border-info/20',
}

const PAYMENT_STYLES: Record<string, string> = {
  unpaid:   'text-danger',
  partial:  'text-warning',
  paid:     'text-success',
  refunded: 'text-info',
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const bookings = await getBookings({ status })

  const activeStatus = status ?? 'all'

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Bookings</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
            {activeStatus !== 'all' ? ` · ${activeStatus.replace('_', ' ')}` : ''}
          </p>
        </div>
        <Link
          href="/bookings/new"
          className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
        >
          <Plus className="h-4 w-4" />
          New booking
        </Link>
      </div>

      {/* ── Status filter tabs ───────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1">
        {STATUSES.map((s) => (
          <Link
            key={s.value}
            href={s.value === 'all' ? '/bookings' : `/bookings?status=${s.value}`}
            className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeStatus === s.value
                ? 'bg-brand text-brand-fg shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {/* ── Bookings list ────────────────────────────────────────── */}
      {bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <CalendarCheck className="h-10 w-10 text-text-disabled" />
          <div>
            <p className="font-medium text-text-primary">No bookings found</p>
            <p className="mt-0.5 text-sm text-text-secondary">
              {activeStatus !== 'all'
                ? 'Try a different filter or create a new booking.'
                : 'Create your first booking to get started.'}
            </p>
          </div>
          <Link
            href="/bookings/new"
            className="mt-2 flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
          >
            <Plus className="h-4 w-4" />
            New booking
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Ref</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Occupant</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium text-text-tertiary sm:table-cell">Room</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium text-text-tertiary md:table-cell">Check in</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Status</th>
                <th className="hidden px-4 py-3 text-right text-xs font-medium text-text-tertiary lg:table-cell">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bookings.map((b) => {
                const occupant = Array.isArray(b.occupant) ? b.occupant[0] : b.occupant
                const room = Array.isArray(b.room) ? b.room[0] : b.room
                const category = room?.category
                  ? Array.isArray(room.category) ? room.category[0] : room.category
                  : null

                return (
                  <tr key={b.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/bookings/${b.id}`} className="ref-number text-xs text-brand hover:text-brand-hover transition-colors">
                        {b.booking_ref}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/bookings/${b.id}`} className="block">
                        <p className="text-sm font-medium text-text-primary">
                          {occupant?.first_name} {occupant?.last_name}
                        </p>
                        {occupant?.phone && (
                          <p className="text-xs text-text-tertiary">{occupant.phone}</p>
                        )}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <p className="text-sm text-text-secondary">
                        {room ? `Room ${room.room_number}` : '—'}
                      </p>
                      {category && <p className="text-xs text-text-tertiary">{category.name}</p>}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell text-sm text-text-secondary">
                      {formatDate(b.check_in_date)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                          STATUS_STYLES[b.status] ?? 'bg-surface-sunken text-text-secondary border-border'
                        }`}
                      >
                        {b.status.replace('_', ' ')}
                      </span>
                      <p className={`mt-0.5 text-[11px] ${PAYMENT_STYLES[b.payment_status] ?? 'text-text-tertiary'}`}>
                        {b.payment_status}
                      </p>
                    </td>
                    <td className="hidden px-4 py-3 text-right lg:table-cell">
                      <p className="currency-amount text-sm font-medium text-text-primary">
                        {formatGHS(b.final_amount)}
                      </p>
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
