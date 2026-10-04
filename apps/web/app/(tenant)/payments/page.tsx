import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { createTenantAdminClient } from '@/lib/supabase/tenant-admin'
import { formatGHS, formatDate } from '@/lib/utils'
import { ReversePaymentButton } from '@/components/bookings/reverse-payment-button'
import {
  getBookingFinancialSummary,
  getBookingRevenueBreakdown,
  getUnappliedBookingReceipts,
} from '@/lib/data/booking-finance'
import { ListPagination } from '@/components/ui/list-pagination'
import { normalisePage, paginateRows } from '@/lib/data/listing'

export const metadata: Metadata = { title: 'Payments' }

const METHOD_LABEL: Record<string, string> = {
  momo_mtn:        'MTN MoMo',
  momo_vodafone:   'Vodafone Cash',
  momo_airteltigo: 'AirtelTigo Money',
  cash:            'Cash',
  bank_transfer:   'Bank Transfer',
  card:            'Card',
  cheque:          'Cheque',
}

const STATUS_STYLES: Record<string, string> = {
  success:  'bg-success-subtle text-success border-success/20',
  pending:  'bg-warning-subtle text-warning-fg border-warning/20',
  failed:   'bg-danger-subtle text-danger border-danger/20',
  reversed: 'bg-surface-sunken text-text-secondary border-border',
}

const FILTERS = [
  { value: 'all',      label: 'All' },
  { value: 'success',  label: 'Success' },
  { value: 'pending',  label: 'Pending' },
  { value: 'failed',   label: 'Failed' },
  { value: 'reversed', label: 'Reversed' },
]

async function getPayments(status: string, search: string, requestedPage: number, tenantId: string) {
  if (!tenantId) return { rows: [] as any[], total: 0, page: 1, pageSize: 100, duplicateCount: 0 }
  const supabase = createTenantAdminClient(tenantId)
  const rows: any[] = []
  const fetchSize = 1000
  for (let from = 0; ; from += fetchSize) {
    let query = supabase
      .from('booking_payments')
      .select(`
        id, amount, method, reference, status, paid_at, notes, created_at,
        booking:bookings(
          id, booking_ref,
          occupant:occupants(first_name, last_name, phone, student_id)
        )
      `)
      .order('created_at', { ascending: false })
      .range(from, from + fetchSize - 1)
    if (status !== 'all') query = query.eq('status', status)
    const { data, error } = await query
    if (error) return { rows: [] as any[], total: 0, page: 1, pageSize: 100, duplicateCount: 0 }
    rows.push(...(data ?? []))
    if ((data ?? []).length < fetchSize) break
  }

  // Flag likely-duplicate manual entries: same booking + amount + method,
  // both successful, recorded on the same calendar day — the exact shape
  // of the accidental-retry duplicate found on ABR-2026-547138. This is a
  // review aid for staff, not an automatic action; a genuine second
  // payment for the same amount on the same day is rare enough for this
  // booking model (semester-lump-sum, not daily installments) to be worth
  // flagging for a human glance either way.
  const groups = new Map<string, string[]>()
  for (const p of rows) {
    if (p.status !== 'success') continue
    const booking = Array.isArray(p.booking) ? p.booking[0] : p.booking
    if (!booking) continue
    const day = (p.paid_at ?? p.created_at).slice(0, 10)
    const key = `${booking.id}|${p.amount}|${p.method}|${day}`
    const arr = groups.get(key) ?? []
    arr.push(p.id)
    groups.set(key, arr)
  }
  const duplicateIds = new Set<string>()
  for (const ids of groups.values()) {
    if (ids.length > 1) ids.forEach((pid) => duplicateIds.add(pid))
  }
  const flagged = rows.map((p) => ({ ...p, possibleDuplicate: duplicateIds.has(p.id) }))

  const searchTerms = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const filtered = searchTerms.length > 0
    ? flagged.filter((p) => {
      const booking = Array.isArray(p.booking) ? p.booking[0] : p.booking
      const occupant = Array.isArray(booking?.occupant) ? booking?.occupant[0] : booking?.occupant
      const haystack = [
        booking?.booking_ref,
        occupant?.first_name,
        occupant?.last_name,
        occupant?.phone,
        occupant?.student_id,
        p.reference,
        p.method,
        p.notes,
      ].filter(Boolean).join(' ').toLowerCase()
      return searchTerms.every((term) => haystack.includes(term))
    })
    : flagged

  return {
    ...paginateRows(filtered, normalisePage(requestedPage)),
    duplicateCount: filtered.filter((payment) => payment.possibleDuplicate).length,
  }
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string; period?: string }>
}) {
  const { status = 'all', q = '', page: pageParam, period: requestedPeriod } = await searchParams
  const period = requestedPeriod === 'mtd' || requestedPeriod === 'all' ? requestedPeriod : 'ytd'
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id') ?? ''
  const callerRole = headersList.get('x-tenant-role')
  const canManage = callerRole === 'owner' || callerRole === 'manager'
  const [result, summary, unappliedRows, allTimeRevenueRows] = await Promise.all([
    getPayments(status, q, Number.parseInt(pageParam ?? '1', 10), tenantId),
    getBookingFinancialSummary(tenantId),
    getUnappliedBookingReceipts(tenantId),
    period === 'all'
      ? getBookingRevenueBreakdown(tenantId, '1970-01-01T00:00:00.000Z', new Date(Date.now() + 86_400_000))
      : Promise.resolve([]),
  ])
  const { rows: payments, total, page, pageSize, duplicateCount } = result
  const periodLabel = period === 'mtd' ? 'Month to date' : period === 'ytd' ? 'Year to date' : 'All time'
  const periodReceived = period === 'mtd'
    ? summary.mtd_received
    : period === 'ytd' ? summary.ytd_received : summary.total_receipts
  const periodRecognized = period === 'mtd'
    ? summary.mtd_recognized
    : period === 'ytd'
      ? summary.ytd_recognized
      : allTimeRevenueRows.reduce((sum, row) => sum + row.total_amount, 0)
  const periodVariance = periodReceived - periodRecognized

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Payments</h1>
        <p className="mt-0.5 text-sm text-text-secondary">Receipts, recognized revenue, and booking-level reconciliation</p>
      </div>

      <div className="flex w-fit rounded-lg border border-border bg-surface-sunken p-1">
        {([
          ['mtd', 'Month to date'],
          ['ytd', 'Year to date'],
          ['all', 'All time'],
        ] as const).map(([value, label]) => (
          <Link
            key={value}
            href={`/payments?period=${value}${status !== 'all' ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              period === value ? 'bg-brand text-brand-fg' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {duplicateCount > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-warning-fg">
          <strong>{duplicateCount} payment{duplicateCount === 1 ? '' : 's'}</strong> look{duplicateCount === 1 ? 's' : ''} like possible duplicates
          (marked below) — same booking, amount, and method recorded on the same day. Review each and use
          {canManage ? ' the Reverse action' : ' a booking\'s Payments card'} to correct any genuine mistakes.
        </div>
      )}

      {/* Summary cards: every period-sensitive figure uses the same window. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-tertiary">Cash received · {periodLabel}</p>
          <p className="mt-1 font-mono text-xl font-bold text-success">{formatGHS(periodReceived)}</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            Successful room and folio receipts in this period
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-tertiary">Recognized revenue · {periodLabel}</p>
          <p className="mt-1 font-mono text-xl font-bold text-text-primary">{formatGHS(periodRecognized)}</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            Net revenue posted to the general ledger
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-tertiary">Cash / revenue variance · {periodLabel}</p>
          <p className={`mt-1 font-mono text-xl font-bold ${periodVariance === 0 ? 'text-success' : 'text-warning-fg'}`}>
            {formatGHS(periodVariance)}
          </p>
          <p className="mt-0.5 text-xs text-text-secondary">
            Timing, cancellation reclassification, or unapplied receipts
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-tertiary">Pending</p>
          <p className="mt-1 font-mono text-xl font-bold text-warning-fg">{formatGHS(summary.pending_payments)}</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            {summary.pending_payment_count} transactions
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-tertiary">Unapplied / held · All time</p>
          <p className="mt-1 font-mono text-xl font-bold text-danger">{formatGHS(summary.unapplied_receipts)}</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            {unappliedRows.length} booking{unappliedRows.length === 1 ? '' : 's'} explain the receipt/invoice gap
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-tertiary">Reversed / Refunded</p>
          <p className="mt-1 font-mono text-xl font-bold text-text-secondary">{formatGHS(summary.total_reversed)}</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            {summary.reversed_payment_count + summary.reversed_charge_count} transactions
            {summary.reversed_charges > 0 && ` · ${formatGHS(summary.reversed_charges)} folio reversals`}
          </p>
        </div>
      </div>

      {unappliedRows.length > 0 && (
        <details className="rounded-xl border border-danger/20 bg-danger-subtle/40 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-text-primary">
            Trace {formatGHS(summary.unapplied_receipts)} to {unappliedRows.length} booking{unappliedRows.length === 1 ? '' : 's'}
          </summary>
          <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-sunken text-left text-xs uppercase tracking-wide text-text-tertiary">
                <tr>
                  <th className="px-3 py-2">Booking</th>
                  <th className="px-3 py-2">Occupant</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2 text-right">Receipts</th>
                  <th className="px-3 py-2 text-right">Applied</th>
                  <th className="px-3 py-2 text-right">Unapplied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {unappliedRows.map((row) => (
                  <tr key={row.booking_id}>
                    <td className="px-3 py-2">
                      <Link href={`/bookings/${row.booking_id}`} className="font-mono text-xs text-brand hover:text-brand-hover">
                        {row.booking_ref}
                      </Link>
                      <p className="text-[11px] capitalize text-text-tertiary">{row.booking_status.replaceAll('_', ' ')}</p>
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{row.occupant_name || '—'}</td>
                    <td className="px-3 py-2 text-xs text-text-secondary">
                      {row.reason === 'cancelled_booking_receipt'
                        ? 'Cancelled booking — cash held for resolution'
                        : row.reason === 'customer_credit'
                          ? 'Payment exceeds invoice'
                          : row.reason === 'enquiry_receipt'
                            ? 'Receipt attached to enquiry'
                            : 'Receipt not applied to invoice'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{formatGHS(row.total_receipts)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatGHS(row.invoice_received)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-danger">{formatGHS(row.unapplied_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Filters + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={`/payments?status=${f.value}&period=${period}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                status === f.value
                  ? 'bg-brand text-brand-fg'
                  : 'bg-surface-raised text-text-secondary hover:text-text-primary'
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        <form method="GET" action="/payments" className="flex gap-2">
          {status !== 'all' && <input type="hidden" name="status" value={status} />}
          <input type="hidden" name="period" value={period} />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search occupant, booking ref, reference…"
            className="w-64 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-colors"
          />
          <button
            type="submit"
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Table */}
      {payments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium text-text-primary">No payments found</p>
          <p className="text-sm text-text-secondary">
            {q ? 'Try a different search term.' : 'Payments are recorded from the booking detail page.'}
          </p>
          {!q && (
            <Link
              href="/bookings"
              className="mt-1 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
            >
              View bookings
            </Link>
          )}
        </div>
      ) : (
        <>
        {/* ── Mobile: card list ──────────────────────────────────── */}
        <ul className="space-y-2.5 md:hidden">
          {payments.map((p) => {
            const booking  = Array.isArray(p.booking) ? p.booking[0] : p.booking
            const occupant = Array.isArray(booking?.occupant) ? booking?.occupant[0] : booking?.occupant
            return (
              <li key={p.id} className="rounded-xl border border-border bg-surface p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {occupant ? `${occupant.first_name} ${occupant.last_name}` : '—'}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {p.paid_at ? formatDate(p.paid_at) : formatDate(p.created_at)}
                      {' · '}{METHOD_LABEL[p.method] ?? p.method}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-semibold text-text-primary">{formatGHS(p.amount)}</p>
                    <span className={`mt-0.5 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${STATUS_STYLES[p.status] ?? 'bg-surface-sunken text-text-secondary border-border'}`}>
                      {p.status}
                    </span>
                  </div>
                </div>
                {p.possibleDuplicate && (
                  <p className="mt-2 inline-flex items-center rounded-full border border-warning/30 bg-warning-subtle px-2 py-0.5 text-[10px] font-medium text-warning-fg">
                    Possible duplicate
                  </p>
                )}
                {booking && (
                  <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2.5 text-xs">
                    <span className="font-mono text-text-tertiary">{booking.booking_ref}</span>
                    <div className="flex items-center gap-3">
                      {canManage && p.status === 'success' && (
                        <ReversePaymentButton bookingId={booking.id} paymentId={p.id} amount={p.amount} />
                      )}
                      <Link href={`/bookings/${booking.id}`} className="font-medium text-brand hover:text-brand-hover">View →</Link>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        {/* ── Desktop: table ─────────────────────────────────────── */}
        <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-sunken">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Occupant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary hidden md:table-cell">Booking</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary hidden lg:table-cell">Method</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary hidden lg:table-cell">Reference</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">Amount</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-text-tertiary">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map((p) => {
                const booking  = Array.isArray(p.booking)  ? p.booking[0]  : p.booking
                const occupant = Array.isArray(booking?.occupant) ? booking?.occupant[0] : booking?.occupant

                return (
                  <tr key={p.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-4 py-3 text-xs text-text-secondary whitespace-nowrap">
                      {p.paid_at ? formatDate(p.paid_at) : formatDate(p.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-primary">
                        {occupant ? `${occupant.first_name} ${occupant.last_name}` : '—'}
                      </p>
                      {occupant?.student_id && (
                        <p className="text-xs text-text-tertiary">{occupant.student_id}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {booking ? (
                        <Link
                          href={`/bookings/${booking.id}`}
                          className="font-mono text-xs text-brand hover:text-brand-hover transition-colors"
                        >
                          {booking.booking_ref}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-text-secondary">
                      {METHOD_LABEL[p.method] ?? p.method}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {p.reference ? (
                        <span className="font-mono text-xs text-text-secondary">{p.reference}</span>
                      ) : (
                        <span className="text-text-disabled">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-text-primary">
                      {formatGHS(p.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[p.status] ?? 'bg-surface-sunken text-text-secondary border-border'}`}>
                        {p.status}
                      </span>
                      {p.possibleDuplicate && (
                        <span className="mt-1 block text-[10px] font-medium text-warning-fg">Possible duplicate</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {canManage && booking && p.status === 'success' && (
                          <ReversePaymentButton bookingId={booking.id} paymentId={p.id} amount={p.amount} />
                        )}
                        {booking && (
                          <Link
                            href={`/bookings/${booking.id}`}
                            className="text-xs font-medium text-brand hover:text-brand-hover transition-colors"
                          >
                            View
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Footer count */}
          <div className="border-t border-border bg-surface-sunken px-4 py-2.5">
            <p className="text-xs text-text-tertiary">
              {payments.length} transaction{payments.length !== 1 ? 's' : ''}
              {q && ` matching "${q}"`}
            </p>
          </div>
        </div>
          <ListPagination pathname="/payments" page={page} pageSize={pageSize} total={total} params={{ status: status === 'all' ? undefined : status, q, period }} />
        </>
      )}
    </div>
  )
}
