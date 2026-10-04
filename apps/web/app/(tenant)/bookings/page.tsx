import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { Plus, CalendarCheck, LayoutGrid, Upload, Search } from 'lucide-react'

import { getBookingsPage } from '@/lib/data/bookings'
import { BookingsBulkList } from '@/components/bookings/bookings-bulk-list'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getServerTenantId } from '@/lib/auth/tenant'
import { Inbox } from 'lucide-react'

const MANAGE_ROLES = ['owner', 'manager'] as const

export const metadata: Metadata = { title: 'Bookings' }

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'pending_payment', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'checked_in', label: 'Checked In' },
  { value: 'checked_out', label: 'Checked Out' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; from?: string; to?: string; page?: string }>
}) {
  const { status, search, from, to, page: pageParam } = await searchParams
  const requestedPage = Number.parseInt(pageParam ?? '1', 10)
  const { bookings, total, page, pageSize } = await getBookingsPage({
    status,
    search,
    from,
    to,
    page: Number.isFinite(requestedPage) ? requestedPage : 1,
  })
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const activeStatus = status ?? 'all'

  // Status tab links need to preserve whatever search/date filter is active,
  // and vice versa (the filter form carries the active status as a hidden
  // field) — so switching one axis never silently drops the other.
  const buildHref = (overrides: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = { status, search, from, to, page: pageParam, ...overrides }
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v)
    }
    const qs = params.toString()
    return qs ? `/bookings?${qs}` : '/bookings'
  }

  // Trial expired without subscribing: bookings stay viewable but not
  // creatable/editable — see middleware.ts's minimal-dashboard allow-list,
  // which also 402s any mutating API call as defense-in-depth.
  const tenantStatus = (await headers()).get('x-tenant-status')
  const readOnly = tenantStatus === 'trial_expired'

  // Self check-in pending count + caller role for management gating.
  let pendingSelfCheckins = 0
  let canManage = false
  let canUpdate = false
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

    // Resolve role from DB (header can be stale) — except a super-admin
    // impersonation session, which has no real tenant_members row for its
    // own user_id by design, so the header (set only after middleware
    // verifies platform_admins membership) is the only source of truth there.
    const isImpersonating = (await headers()).get('x-admin-impersonating') === 'true'
    if (isImpersonating) {
      const role = (await headers()).get('x-tenant-role')
      canManage = !!role && (MANAGE_ROLES as readonly string[]).includes(role)
      canUpdate = canManage || role === 'receptionist'
    } else {
      const authClient = await createClient()
      const {
        data: { user },
      } = await authClient.auth.getUser()
      if (user) {
        const { data: member } = await admin
          .from('tenant_members')
          .select('role, is_active')
          .eq('user_id', user.id)
          .eq('tenant_id', tenantId)
          .maybeSingle()
        const role = (member as any)?.is_active ? (member as any).role : null
        canManage = !!role && (MANAGE_ROLES as readonly string[]).includes(role)
        canUpdate = canManage || role === 'receptionist'
      }
    }
  }
  if (readOnly) canManage = false
  if (readOnly) canUpdate = false

  // Normalise bookings for client component
  const rows = bookings.map((b) => {
    const occupant = Array.isArray(b.occupant) ? b.occupant[0] : b.occupant
    const room = Array.isArray(b.room) ? b.room[0] : b.room
    const category = room?.category
      ? Array.isArray(room.category)
        ? room.category[0]
        : room.category
      : null
    return {
      id: b.id,
      booking_ref: b.booking_ref,
      status: b.status,
      payment_status: b.payment_status,
      check_in_date: b.check_in_date,
      final_amount: b.final_amount,
      group_id: b.group_id,
      occupant: occupant
        ? {
            first_name: occupant.first_name,
            last_name: occupant.last_name,
            phone: occupant.phone,
          }
        : null,
      room: room
        ? {
            room_number: room.room_number,
            category: category ? { name: category.name } : null,
          }
        : null,
    }
  })

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-text-primary text-2xl font-bold">Bookings</h1>
          <p className="text-text-secondary mt-0.5 text-sm">
            {total} booking{total !== 1 ? 's' : ''}
            {activeStatus !== 'all' ? ` · ${activeStatus.replace('_', ' ')}` : ''}
            {search ? ` · matching "${search}"` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/bookings/self-checkins"
            className="border-border text-text-secondary hover:text-text-primary hover:bg-surface-raised relative flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
          >
            <Inbox className="h-4 w-4" />
            Self check-ins
            {pendingSelfCheckins > 0 && (
              <span className="bg-brand ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold text-white">
                {pendingSelfCheckins}
              </span>
            )}
          </Link>
          <Link
            href="/bookings/calendar"
            className="border-border text-text-secondary hover:text-text-primary hover:bg-surface-raised flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
          >
            <LayoutGrid className="h-4 w-4" />
            Calendar
          </Link>
          {!readOnly && (
            <>
              <Link
                href="/bookings/bulk-import"
                className="border-border text-text-secondary hover:text-text-primary hover:bg-surface-raised flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
              >
                <Upload className="h-4 w-4" />
                Import
              </Link>
              <Link
                href="/bookings/new"
                className="bg-brand text-brand-fg hover:bg-brand-hover flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition-colors"
              >
                <Plus className="h-4 w-4" />
                New booking
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── Status filter tabs ───────────────────────────────────── */}
      <div className="border-border bg-surface flex gap-1 overflow-x-auto rounded-lg border p-1">
        {STATUSES.map((s) => (
          <Link
            key={s.value}
            href={buildHref({ status: s.value === 'all' ? undefined : s.value, page: undefined })}
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

      {/* ── Search + date-range filter ───────────────────────────── */}
      <form action="/bookings" method="get" className="flex flex-wrap items-center gap-2">
        {activeStatus !== 'all' && <input type="hidden" name="status" value={activeStatus} />}
        <div className="relative min-w-[200px] flex-1">
          <Search className="text-text-disabled pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            type="text"
            name="search"
            defaultValue={search ?? ''}
            placeholder="Search by name, phone, ref, or room…"
            className="border-border bg-surface text-text-primary placeholder:text-text-disabled focus:border-brand w-full rounded-md border py-2 pl-9 pr-3 text-sm focus:outline-none"
          />
        </div>
        <input
          type="date"
          name="from"
          defaultValue={from ?? ''}
          aria-label="Check-in from"
          className="border-border bg-surface text-text-primary focus:border-brand rounded-md border px-3 py-2 text-sm focus:outline-none"
        />
        <span className="text-text-secondary text-sm">to</span>
        <input
          type="date"
          name="to"
          defaultValue={to ?? ''}
          aria-label="Check-in to"
          className="border-border bg-surface text-text-primary focus:border-brand rounded-md border px-3 py-2 text-sm focus:outline-none"
        />
        <button
          type="submit"
          className="bg-brand text-brand-fg hover:bg-brand-hover rounded-md px-3 py-2 text-sm font-semibold transition-colors"
        >
          Filter
        </button>
        {(search || from || to) && (
          <Link
            href={activeStatus !== 'all' ? `/bookings?status=${activeStatus}` : '/bookings'}
            className="text-text-secondary hover:text-text-primary text-sm underline"
          >
            Clear
          </Link>
        )}
      </form>

      {/* ── Bookings list ────────────────────────────────────────── */}
      {bookings.length === 0 ? (
        <div className="border-border flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <CalendarCheck className="text-text-disabled h-10 w-10" />
          <div>
            <p className="text-text-primary font-medium">No bookings found</p>
            <p className="text-text-secondary mt-0.5 text-sm">
              {search || from || to || activeStatus !== 'all'
                ? 'Try a different search or filter.'
                : 'Create your first booking to get started.'}
            </p>
          </div>
          {!readOnly && (
            <Link
              href="/bookings/new"
              className="bg-brand text-brand-fg hover:bg-brand-hover mt-2 flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-colors"
            >
              <Plus className="h-4 w-4" />
              New booking
            </Link>
          )}
        </div>
      ) : (
        <>
          <BookingsBulkList bookings={rows} canManage={canManage} canUpdate={canUpdate} />
          {totalPages > 1 && (
            <nav
              aria-label="Bookings pagination"
              className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-4"
            >
              <p className="text-text-secondary text-sm">
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Link
                    href={buildHref({ page: page === 2 ? undefined : String(page - 1) })}
                    className="border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-md border px-3 py-2 text-sm font-medium"
                  >
                    Previous
                  </Link>
                ) : (
                  <span className="border-border text-text-disabled rounded-md border px-3 py-2 text-sm font-medium">
                    Previous
                  </span>
                )}
                <span className="text-text-secondary px-1 text-sm">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages ? (
                  <Link
                    href={buildHref({ page: String(page + 1) })}
                    className="border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-md border px-3 py-2 text-sm font-medium"
                  >
                    Next
                  </Link>
                ) : (
                  <span className="border-border text-text-disabled rounded-md border px-3 py-2 text-sm font-medium">
                    Next
                  </span>
                )}
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
