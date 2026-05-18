import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, CalendarCheck, LayoutGrid, Upload } from 'lucide-react'

import { getBookings } from '@/lib/data/bookings'
import { BookingsBulkList } from '@/components/bookings/bookings-bulk-list'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { Inbox } from 'lucide-react'

export const metadata: Metadata = { title: 'Bookings' }

const STATUSES = [
  { value: 'all',             label: 'All' },
  { value: 'pending_payment', label: 'Pending' },
  { value: 'confirmed',       label: 'Confirmed' },
  { value: 'checked_in',      label: 'Checked In' },
  { value: 'checked_out',     label: 'Checked Out' },
  { value: 'cancelled',       label: 'Cancelled' },
]

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const bookings = await getBookings({ status })

  const activeStatus = status ?? 'all'

  // Self check-in pending count
  let pendingSelfCheckins = 0
  const tenantId = await getServerTenantId()
  if (tenantId) {
    const admin = createAdminClient()
    const { count } = await admin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .not('self_checkin_submitted_at', 'is', null)
      .is('self_checkin_confirmed_at', null)
    pendingSelfCheckins = count ?? 0
  }

  // Normalise bookings for client component
  const rows = bookings.map((b) => {
    const occupant = Array.isArray(b.occupant) ? b.occupant[0] : b.occupant
    const room     = Array.isArray(b.room)     ? b.room[0]     : b.room
    const category = room?.category
      ? Array.isArray(room.category) ? room.category[0] : room.category
      : null
    return {
      id:             b.id,
      booking_ref:    b.booking_ref,
      status:         b.status,
      payment_status: b.payment_status,
      check_in_date:  b.check_in_date,
      final_amount:   b.final_amount,
      occupant:       occupant ? {
        first_name: occupant.first_name,
        last_name:  occupant.last_name,
        phone:      occupant.phone,
      } : null,
      room: room ? {
        room_number: room.room_number,
        category:    category ? { name: category.name } : null,
      } : null,
    }
  })

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
        <div className="flex items-center gap-2">
          <Link
            href="/bookings/self-checkins"
            className="relative flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors"
          >
            <Inbox className="h-4 w-4" />
            Self check-ins
            {pendingSelfCheckins > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white">
                {pendingSelfCheckins}
              </span>
            )}
          </Link>
          <Link
            href="/bookings/calendar"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors"
          >
            <LayoutGrid className="h-4 w-4" />
            Calendar
          </Link>
          <Link
            href="/bookings/bulk-import"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors"
          >
            <Upload className="h-4 w-4" />
            Import
          </Link>
          <Link
            href="/bookings/new"
            className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
          >
            <Plus className="h-4 w-4" />
            New booking
          </Link>
        </div>
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
        <BookingsBulkList bookings={rows} />
      )}
    </div>
  )
}
