import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { FileText, Search } from 'lucide-react'
import { getInvoicesPage } from '@/lib/data/invoices'
import { calculateInvoiceFinancials, getBookingFinancialSummary } from '@/lib/data/booking-finance'
import { formatGHS, formatDate } from '@/lib/utils'
import { ListPagination } from '@/components/ui/list-pagination'

export const metadata: Metadata = { title: 'Invoices' }

const FILTERS = [
  { value: 'all',             label: 'All' },
  { value: 'unpaid',          label: 'Unpaid' },
  { value: 'partial',         label: 'Partial' },
  { value: 'paid',            label: 'Paid' },
]

const PAYMENT_BADGE: Record<string, string> = {
  unpaid:   'bg-danger-subtle text-danger border-danger/20',
  partial:  'bg-warning-subtle text-warning-fg border-warning/20',
  paid:     'bg-success-subtle text-success border-success/20',
  refunded: 'bg-surface-sunken text-text-secondary border-border',
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>
}) {
  const { status = 'all', q = '', page: pageParam } = await searchParams
  const headersList = await headers()
  const tenantName = headersList.get('x-tenant-name') ?? 'Your Property'

  const [result, summary] = await Promise.all([
    getInvoicesPage({ payment_status: status, search: q, page: Number.parseInt(pageParam ?? '1', 10) }),
    getBookingFinancialSummary(),
  ])
  const { rows: invoices, total, page, pageSize } = result

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Invoices</h1>
          <p className="mt-0.5 text-sm text-text-secondary">Billing records for {tenantName}</p>
        </div>
      </div>

      <form method="get" className="flex max-w-lg gap-2">
        {status !== 'all' && <input type="hidden" name="status" value={status} />}
        <div className="relative flex-1">
          <Search className="text-text-disabled pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search occupant, invoice, room, phone, or ID…"
            className="border-border bg-surface text-text-primary placeholder:text-text-disabled focus:border-brand w-full rounded-md border py-2 pl-9 pr-3 text-sm focus:outline-none"
          />
        </div>
        <button className="bg-brand text-brand-fg hover:bg-brand-hover rounded-md px-3 py-2 text-sm font-semibold">Search</button>
      </form>

      {/* Summary bar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4">
        {[
          { label: 'Total invoiced', value: summary.total_invoiced, color: 'text-text-primary' },
          { label: 'Applied receipts', value: summary.invoice_received, color: 'text-success' },
          { label: 'Outstanding', value: summary.outstanding, color: summary.outstanding > 0 ? 'text-danger' : 'text-text-primary' },
          { label: 'Unapplied / credit', value: summary.unapplied_receipts, color: summary.unapplied_receipts > 0 ? 'text-warning-fg' : 'text-text-primary' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-text-tertiary">{s.label}</p>
            <p className={`mt-1 text-lg font-bold font-mono ${s.color}`}>{formatGHS(s.value)}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`${f.value === 'all' ? '/invoices' : `/invoices?status=${f.value}`}${q ? `${f.value === 'all' ? '?' : '&'}q=${encodeURIComponent(q)}` : ''}`}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              status === f.value || (f.value === 'all' && status === 'all')
                ? 'bg-brand text-brand-fg'
                : 'bg-surface-raised text-text-secondary hover:text-text-primary'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* Table */}
      {invoices.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <FileText className="h-8 w-8 text-text-disabled" />
          <p className="font-medium text-text-primary">No invoices yet</p>
          <p className="text-sm text-text-secondary">Invoices are generated automatically from bookings.</p>
          <Link
            href="/bookings/new"
            className="mt-1 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
          >
            Create booking
          </Link>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-sunken">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wide">Invoice #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wide">Occupant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wide hidden md:table-cell">Room</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wide hidden lg:table-cell">Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-text-tertiary uppercase tracking-wide">Amount</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-text-tertiary uppercase tracking-wide hidden sm:table-cell">Balance</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-text-tertiary uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((inv) => {
                const occupant = Array.isArray(inv.occupant) ? inv.occupant[0] : inv.occupant
                const room     = Array.isArray(inv.room)     ? inv.room[0]     : inv.room
                const cat      = Array.isArray(room?.category) ? room?.category[0] : room?.category
                const financials = calculateInvoiceFinancials(inv)

                return (
                  <tr key={inv.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">{inv.booking_ref}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-primary">
                        {occupant?.first_name} {occupant?.last_name}
                      </p>
                      {occupant?.student_id && (
                        <p className="text-xs text-text-tertiary">{occupant.student_id}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-text-secondary">
                      Room {room?.room_number}
                      {room?.block ? ` · Block ${room.block}` : ''}
                      {cat ? ` · ${cat.name}` : ''}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-text-secondary text-xs">
                      {formatDate(inv.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-text-primary">
                      {formatGHS(financials.invoiceTotal)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono hidden sm:table-cell">
                      <span className={financials.outstanding > 0 ? 'text-danger font-semibold' : 'text-success'}>
                        {formatGHS(financials.outstanding)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${PAYMENT_BADGE[financials.paymentStatus] ?? 'bg-surface-sunken text-text-secondary border-border'}`}>
                        {financials.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="text-xs font-medium text-brand hover:text-brand-hover transition-colors"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            </table>
          </div>
          <ListPagination pathname="/invoices" page={page} pageSize={pageSize} total={total} params={{ status: status === 'all' ? undefined : status, q }} />
        </>
      )}
    </div>
  )
}
