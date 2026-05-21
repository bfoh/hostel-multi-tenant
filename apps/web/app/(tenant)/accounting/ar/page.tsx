import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertCircle, ArrowRight, Mail, Phone, Users } from 'lucide-react'

import { getAgingReport, AGING_BUCKETS, type AgingBucketId, type AgingReport } from '@/lib/data/ar-aging'
import { formatGHS } from '@/lib/utils'
import { ExportCsvButton } from '@/components/accounting/export-csv-button'
import { SendReminderButton } from '@/components/accounting/send-reminder-button'

export const metadata: Metadata = { title: 'Accounts Receivable · Aging' }

const BUCKET_TONE: Record<AgingBucketId, { bg: string; text: string; barBg: string }> = {
  current: { bg: 'bg-surface-raised',         text: 'text-text-secondary', barBg: 'bg-text-tertiary' },
  '1_30':  { bg: 'bg-blue-50 dark:bg-blue-950/30',     text: 'text-blue-700 dark:text-blue-300',   barBg: 'bg-blue-400' },
  '31_60': { bg: 'bg-amber-50 dark:bg-amber-950/30',   text: 'text-amber-700 dark:text-amber-300', barBg: 'bg-amber-400' },
  '61_90': { bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-300', barBg: 'bg-orange-400' },
  '90_plus':{bg: 'bg-red-50 dark:bg-red-950/30',       text: 'text-red-700 dark:text-red-300',     barBg: 'bg-red-500' },
}

export default async function AccountsReceivablePage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: AgingBucketId; view?: 'invoices' | 'customers' }>
}) {
  const sp = await searchParams
  const view = sp.view ?? 'customers'
  const bucketFilter = sp.bucket

  const report = await getAgingReport()

  if (!report) {
    return (
      <div className="rounded-xl border border-border bg-surface p-12 text-center">
        <p className="text-sm text-text-secondary">No tenant context.</p>
      </div>
    )
  }

  const filteredInvoices = bucketFilter
    ? report.invoices.filter((i) => i.bucket === bucketFilter)
    : report.invoices

  const filteredCustomers = bucketFilter
    ? report.customers.filter((c) => c.bucketTotals[bucketFilter] > 0)
    : report.customers

  const csvRows = report.invoices.map((i) => [
    i.booking_ref ?? '',
    i.occupant ? `${i.occupant.first_name} ${i.occupant.last_name}` : '',
    i.check_in_date ?? '',
    i.daysOverdue.toString(),
    AGING_BUCKETS.find((b) => b.id === i.bucket)?.label ?? '',
    (i.final_amount / 100).toFixed(2),
    (i.paid_amount / 100).toFixed(2),
    (i.balance / 100).toFixed(2),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Accounts Receivable</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Outstanding invoices aged by check-in date · as at{' '}
            <strong className="text-text-primary">
              {new Date(report.asOf).toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })}
            </strong>
          </p>
        </div>
        <ExportCsvButton
          filename={`ar-aging-${report.asOf}`}
          headers={['Booking ref', 'Customer', 'Due date', 'Days overdue', 'Bucket', 'Total (GHS)', 'Paid (GHS)', 'Balance (GHS)']}
          rows={csvRows}
        />
      </div>

      {/* Total + bucket KPIs */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="border-b border-border bg-surface-raised px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-text-tertiary">Total outstanding</p>
            <p className="mt-0.5 text-2xl font-bold currency-amount text-text-primary">
              {formatGHS(report.totalOutstanding)}
            </p>
          </div>
          <p className="text-xs text-text-tertiary">
            {report.invoices.length} open invoice{report.invoices.length === 1 ? '' : 's'} · {report.customers.length} customer{report.customers.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-5">
          {AGING_BUCKETS.map((b) => {
            const tone = BUCKET_TONE[b.id]
            const total = report.bucketTotals[b.id]
            const count = report.bucketCounts[b.id]
            const active = bucketFilter === b.id
            const share = report.totalOutstanding > 0 ? (total / report.totalOutstanding) * 100 : 0

            return (
              <Link
                key={b.id}
                href={active ? `/accounting/ar?view=${view}` : `/accounting/ar?bucket=${b.id}&view=${view}`}
                className={`block px-4 py-3 transition-colors ${active ? tone.bg : 'bg-surface hover:bg-surface-raised'}`}
              >
                <p className={`text-[11px] font-semibold uppercase tracking-wide ${tone.text}`}>{b.label}</p>
                <p className="mt-1.5 text-base font-bold currency-amount text-text-primary">{formatGHS(total)}</p>
                <p className="mt-0.5 text-[11px] text-text-tertiary">
                  {count} invoice{count === 1 ? '' : 's'} · {share.toFixed(0)}%
                </p>
                <div className="mt-2 h-1 w-full rounded-full bg-surface-raised overflow-hidden">
                  <div className={`h-full ${tone.barBg}`} style={{ width: `${share}%` }} />
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* View switcher */}
      <div className="flex items-center gap-2">
        <Link
          href={`/accounting/ar?view=customers${bucketFilter ? `&bucket=${bucketFilter}` : ''}`}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            view === 'customers'
              ? 'bg-brand text-white'
              : 'border border-border bg-surface text-text-secondary hover:text-text-primary'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          By customer ({filteredCustomers.length})
        </Link>
        <Link
          href={`/accounting/ar?view=invoices${bucketFilter ? `&bucket=${bucketFilter}` : ''}`}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            view === 'invoices'
              ? 'bg-brand text-white'
              : 'border border-border bg-surface text-text-secondary hover:text-text-primary'
          }`}
        >
          <AlertCircle className="h-3.5 w-3.5" />
          By invoice ({filteredInvoices.length})
        </Link>
        {bucketFilter && (
          <Link
            href={`/accounting/ar?view=${view}`}
            className="text-xs text-text-tertiary hover:text-text-primary transition-colors"
          >
            Clear bucket filter
          </Link>
        )}
      </div>

      {view === 'customers' ? (
        <CustomersTable customers={filteredCustomers} />
      ) : (
        <InvoicesTable invoices={filteredInvoices} />
      )}
    </div>
  )
}

/* ── Tables ─────────────────────────────────────────────────────────────── */

function CustomersTable({
  customers,
}: {
  customers: AgingReport['customers']
}) {
  if (customers.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-12 text-center">
        <p className="text-sm text-text-secondary">No customers with outstanding balances.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[800px]">
        <thead className="bg-surface-raised">
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Customer</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Contact</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary w-24">Invoices</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary w-28">Oldest (d)</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary w-36">Balance</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary w-20"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {customers.map((c) => {
            const oldestBucketId = (Object.keys(c.bucketTotals) as AgingBucketId[])
              .filter((b) => c.bucketTotals[b] > 0)
              .sort((a, b) => AGING_BUCKETS.findIndex((x) => x.id === b) - AGING_BUCKETS.findIndex((x) => x.id === a))[0]
            const tone = oldestBucketId ? BUCKET_TONE[oldestBucketId] : BUCKET_TONE.current

            return (
              <tr key={c.occupant_id} className="hover:bg-surface-raised/50 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    href={`/accounting/ar/${c.occupant_id}`}
                    className="text-sm font-medium text-text-primary hover:text-brand transition-colors"
                  >
                    {c.first_name} {c.last_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs text-text-secondary">
                  <div className="flex flex-wrap items-center gap-3">
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:text-brand transition-colors">
                        <Phone className="h-3 w-3" />
                        {c.phone}
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-brand transition-colors">
                        <Mail className="h-3 w-3" />
                        {c.email}
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-sm text-text-secondary tabular-nums">
                  {c.invoiceCount}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${tone.bg} ${tone.text}`}>
                    {c.oldestDaysOverdue > 0 ? `${c.oldestDaysOverdue}d` : 'Current'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold currency-amount text-text-primary">
                  {formatGHS(c.totalOutstanding)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {c.oldestDaysOverdue > 0 && c.phone && (
                      <SendReminderButton occupantId={c.occupant_id} balance={c.totalOutstanding} compact />
                    )}
                    <Link
                      href={`/accounting/ar/${c.occupant_id}`}
                      className="inline-flex items-center gap-0.5 text-xs text-brand hover:opacity-80 transition-opacity"
                    >
                      Statement <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function InvoicesTable({
  invoices,
}: {
  invoices: AgingReport['invoices']
}) {
  if (invoices.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-12 text-center">
        <p className="text-sm text-text-secondary">No outstanding invoices in this bucket.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[900px]">
        <thead className="bg-surface-raised">
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary w-32">Booking ref</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Customer</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary w-32">Check-in</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary w-24">Overdue</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary w-32">Bucket</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary w-28">Invoiced</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary w-28">Paid</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary w-28">Balance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {invoices.map((inv) => {
            const tone = BUCKET_TONE[inv.bucket]
            const bucketLabel = AGING_BUCKETS.find((b) => b.id === inv.bucket)?.label ?? ''
            return (
              <tr key={inv.id} className="hover:bg-surface-raised/50 transition-colors">
                <td className="px-4 py-2.5 text-sm">
                  <Link href={`/invoices/${inv.id}`} className="font-mono text-xs text-brand hover:opacity-80 transition-opacity">
                    {inv.booking_ref ?? inv.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-sm text-text-primary">
                  {inv.occupant
                    ? `${inv.occupant.first_name} ${inv.occupant.last_name}`
                    : <span className="text-text-tertiary italic">Unknown</span>}
                </td>
                <td className="px-4 py-2.5 text-xs text-text-secondary">
                  {inv.check_in_date
                    ? new Date(inv.check_in_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: '2-digit' })
                    : '—'}
                </td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">
                  {inv.daysOverdue > 0 ? `${inv.daysOverdue}d` : '—'}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.bg} ${tone.text}`}>
                    {bucketLabel}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right text-sm currency-amount text-text-primary">
                  {formatGHS(inv.final_amount)}
                </td>
                <td className="px-4 py-2.5 text-right text-sm currency-amount text-text-secondary">
                  {formatGHS(inv.paid_amount)}
                </td>
                <td className="px-4 py-2.5 text-right text-sm font-semibold currency-amount text-danger">
                  {formatGHS(inv.balance)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
