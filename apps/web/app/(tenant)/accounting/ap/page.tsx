import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, ArrowRight, AlertTriangle } from 'lucide-react'

import { getBills, getApSummary, getVendorBalances, type BillStatus } from '@/lib/data/ap'
import { formatGHS } from '@/lib/utils'
import { ExportCsvButton } from '@/components/accounting/export-csv-button'

export const metadata: Metadata = { title: 'Accounts Payable' }

const STATUS_FILTERS: { id: 'open' | BillStatus | 'all'; label: string }[] = [
  { id: 'open',      label: 'Open'      },
  { id: 'draft',     label: 'Draft'     },
  { id: 'approved',  label: 'Approved'  },
  { id: 'partial',   label: 'Partial'   },
  { id: 'paid',      label: 'Paid'      },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'all',       label: 'All'       },
]

const STATUS_BADGE: Record<BillStatus, string> = {
  draft:     'bg-surface-raised text-text-secondary border-border',
  approved:  'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200/40',
  partial:   'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200/40',
  paid:      'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border-green-200/40',
  cancelled: 'bg-surface-raised text-text-tertiary line-through border-border',
}

export default async function AccountsPayablePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: 'open' | BillStatus | 'all' }>
}) {
  const { status = 'open' } = await searchParams

  const [bills, summary, vendors] = await Promise.all([
    getBills({ status }),
    getApSummary(),
    getVendorBalances(),
  ])

  const csvRows = bills.map((b) => [
    b.vendor_name,
    b.bill_number ?? '',
    b.bill_date,
    b.due_date,
    b.status,
    b.category,
    (b.amount / 100).toFixed(2),
    (b.paid_amount / 100).toFixed(2),
    (b.balance / 100).toFixed(2),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Accounts Payable</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Supplier bills with approval → pay workflow · auto-posts to journal
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportCsvButton
            filename="ap-bills"
            headers={['Vendor', 'Bill #', 'Bill date', 'Due date', 'Status', 'Category', 'Amount (GHS)', 'Paid (GHS)', 'Balance (GHS)']}
            rows={csvRows}
          />
          <Link
            href="/accounting/ap/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            New bill
          </Link>
        </div>
      </div>

      {/* KPIs */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi label="Outstanding"          value={formatGHS(summary.totalOutstanding)} sublabel={`${summary.totalOpenBills} open bill${summary.totalOpenBills === 1 ? '' : 's'}`} tone="brand" />
          <Kpi label="Overdue"              value={formatGHS(summary.overdueAmount)}    sublabel={`${summary.overdueCount} bill${summary.overdueCount === 1 ? '' : 's'} past due`} tone={summary.overdueAmount > 0 ? 'danger' : 'neutral'} icon={summary.overdueAmount > 0 ? AlertTriangle : undefined} />
          <Kpi label="Due in ≤ 7 days"      value={formatGHS(summary.dueIn7DaysAmount)} sublabel={`${summary.dueIn7DaysCount} bill${summary.dueIn7DaysCount === 1 ? '' : 's'}`}     tone={summary.dueIn7DaysAmount > 0 ? 'warning' : 'neutral'} />
          <Kpi label="Awaiting approval"    value={formatGHS(summary.byStatus.draft.amount)} sublabel={`${summary.byStatus.draft.count} draft${summary.byStatus.draft.count === 1 ? '' : 's'}`} tone="neutral" />
        </div>
      )}

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1 w-fit max-w-full overflow-x-auto">
        {STATUS_FILTERS.map((f) => {
          const active = status === f.id
          return (
            <Link
              key={f.id}
              href={`/accounting/ap?status=${f.id}`}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                active ? 'bg-brand text-white' : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
              }`}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Bills table */}
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          {bills.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-text-secondary">No bills match this filter.</p>
              <Link
                href="/accounting/ap/new"
                className="mt-3 inline-flex items-center gap-1 text-sm text-brand hover:opacity-80 transition-opacity"
              >
                <Plus className="h-3.5 w-3.5" />
                Capture your first bill
              </Link>
            </div>
          ) : (
            <table className="w-full min-w-[700px]">
              <thead className="bg-surface-raised">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Vendor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Bill</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary w-28">Due</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary w-28">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary w-32">Balance</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {bills.map((b) => {
                  const overdue = b.daysUntilDue < 0 && (b.status === 'approved' || b.status === 'partial')
                  return (
                    <tr key={b.id} className="hover:bg-surface-raised/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-text-primary">{b.vendor_name}</p>
                        {b.bill_number && <p className="mt-0.5 text-[11px] text-text-tertiary">#{b.bill_number}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary max-w-xs">
                        <p className="truncate">{b.description}</p>
                        <p className="mt-0.5 text-text-tertiary">{b.category}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-text-primary">
                          {new Date(b.due_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </p>
                        {overdue && (
                          <p className="mt-0.5 text-[11px] font-semibold text-danger">{Math.abs(b.daysUntilDue)}d overdue</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_BADGE[b.status]}`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-sm font-semibold currency-amount text-text-primary">{formatGHS(b.balance)}</p>
                        {b.paid_amount > 0 && b.balance > 0 && (
                          <p className="mt-0.5 text-[11px] text-text-tertiary">paid {formatGHS(b.paid_amount)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/accounting/ap/${b.id}`}
                          className="inline-flex items-center gap-0.5 text-xs text-brand hover:opacity-80 transition-opacity"
                        >
                          Open <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Vendor balances sidecar */}
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="border-b border-border bg-surface-raised px-4 py-3">
            <h2 className="text-sm font-semibold text-text-primary">Vendor balances</h2>
            <p className="mt-0.5 text-[11px] text-text-tertiary">Open bills only</p>
          </div>
          {vendors.length === 0 ? (
            <p className="px-4 py-6 text-sm text-text-tertiary">No outstanding bills.</p>
          ) : (
            <div className="divide-y divide-border/40">
              {vendors.slice(0, 10).map((v) => (
                <Link
                  key={v.vendor_name}
                  href={`/accounting/ap?status=open`}
                  className="block px-4 py-2.5 hover:bg-surface-raised/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-text-primary truncate">{v.vendor_name}</p>
                    <p className="shrink-0 text-sm font-semibold currency-amount text-text-primary">
                      {formatGHS(v.totalOutstanding)}
                    </p>
                  </div>
                  <p className="mt-0.5 text-[11px] text-text-tertiary">
                    {v.openBillCount} bill{v.openBillCount === 1 ? '' : 's'} · oldest due {v.oldestDueDate
                      ? new Date(v.oldestDueDate).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })
                      : '—'}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Kpi({
  label, value, sublabel, tone, icon: Icon,
}: {
  label: string
  value: string
  sublabel?: string
  tone: 'brand' | 'danger' | 'warning' | 'neutral'
  icon?: React.ElementType
}) {
  const color = {
    brand:   'text-brand',
    danger:  'text-danger',
    warning: 'text-warning',
    neutral: 'text-text-primary',
  }[tone]
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-secondary">{label}</p>
        {Icon && <Icon className={`h-3.5 w-3.5 ${color}`} />}
      </div>
      <p className={`mt-2 text-xl font-bold currency-amount ${color}`}>{value}</p>
      {sublabel && <p className="mt-1 text-[11px] text-text-tertiary">{sublabel}</p>}
    </div>
  )
}
