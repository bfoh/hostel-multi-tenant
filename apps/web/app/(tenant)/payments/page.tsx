import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatGHS, formatDate } from '@/lib/utils'

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

async function getPayments(status: string, search: string) {
  const supabase = await createClient()

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
    .limit(200)

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) return []

  const rows = data ?? []

  if (search) {
    const q = search.toLowerCase()
    return rows.filter((p) => {
      const booking = Array.isArray(p.booking) ? p.booking[0] : p.booking
      const occupant = Array.isArray(booking?.occupant) ? booking?.occupant[0] : booking?.occupant
      return (
        booking?.booking_ref?.toLowerCase().includes(q) ||
        occupant?.first_name?.toLowerCase().includes(q) ||
        occupant?.last_name?.toLowerCase().includes(q) ||
        occupant?.student_id?.toLowerCase().includes(q) ||
        p.reference?.toLowerCase().includes(q)
      )
    })
  }

  return rows
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const { status = 'all', q = '' } = await searchParams
  const payments = await getPayments(status, q)

  const totalSuccess  = payments.filter((p) => p.status === 'success').reduce((s, p) => s + p.amount, 0)
  const totalPending  = payments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0)
  const totalReversed = payments.filter((p) => p.status === 'reversed').reduce((s, p) => s + p.amount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Payments</h1>
        <p className="mt-0.5 text-sm text-text-secondary">All payment transactions across bookings</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-tertiary">Total received</p>
          <p className="mt-1 font-mono text-xl font-bold text-success">{formatGHS(totalSuccess)}</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            {payments.filter((p) => p.status === 'success').length} transactions
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-tertiary">Pending</p>
          <p className="mt-1 font-mono text-xl font-bold text-warning-fg">{formatGHS(totalPending)}</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            {payments.filter((p) => p.status === 'pending').length} transactions
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-tertiary">Reversed / Refunded</p>
          <p className="mt-1 font-mono text-xl font-bold text-text-secondary">{formatGHS(totalReversed)}</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            {payments.filter((p) => p.status === 'reversed').length} transactions
          </p>
        </div>
      </div>

      {/* Filters + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={`/payments?status=${f.value}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
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
        <div className="overflow-hidden rounded-xl border border-border">
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
                    </td>
                    <td className="px-4 py-3 text-right">
                      {booking && (
                        <Link
                          href={`/bookings/${booking.id}`}
                          className="text-xs font-medium text-brand hover:text-brand-hover transition-colors"
                        >
                          View
                        </Link>
                      )}
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
      )}
    </div>
  )
}
