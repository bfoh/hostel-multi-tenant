import type { Metadata } from 'next'
import Link from 'next/link'
import {
  TrendingUp, TrendingDown, Users, BedDouble,
  AlertTriangle, BarChart3, CreditCard, ArrowUpRight, Zap,
} from 'lucide-react'
import { formatGHS } from '@/lib/utils'
import {
  getRevenueReport,
  getPaymentMethodBreakdown,
  getOccupancyReport,
  getOverdueRent,
  getBookingSummary,
  getYtdSummary,
} from '@/lib/data/reports'
import { getServerTenantId } from '@/lib/auth/tenant'
import { notFound } from 'next/navigation'

export const metadata: Metadata = { title: 'Reports' }

const METHOD_LABEL: Record<string, string> = {
  momo_mtn:        'MTN MoMo',
  momo_vodafone:   'Vodafone Cash',
  momo_airteltigo: 'AirtelTigo Money',
  cash:            'Cash',
  bank_transfer:   'Bank Transfer',
  card:            'Card',
  cheque:          'Cheque',
}

const BOOKING_STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Pending Payment',
  confirmed:       'Confirmed',
  checked_in:      'Checked In',
  checked_out:     'Checked Out',
  cancelled:       'Cancelled',
}

const BOOKING_STATUS_COLOR: Record<string, string> = {
  pending_payment: 'bg-warning',
  confirmed:       'bg-info',
  checked_in:      'bg-success',
  checked_out:     'bg-border',
  cancelled:       'bg-danger',
}

const HK_LABEL: Record<string, string> = {
  clean:        'Clean',
  dirty:        'Dirty',
  inspecting:   'Inspecting',
  out_of_order: 'Out of Order',
}

const SOURCE_LABEL: Record<string, string> = {
  walk_in:  'Walk-in',
  phone:    'Phone',
  website:  'Website',
  widget:   'Booking Widget',
  voice_ai: 'Voice AI',
  referral: 'Referral',
}

const HK_COLOR: Record<string, string> = {
  clean:        'bg-success',
  dirty:        'bg-warning',
  inspecting:   'bg-info',
  out_of_order: 'bg-danger',
}

const REPORT_TABS = [
  { value: 'overview',   label: 'Overview' },
  { value: 'revenue',    label: 'Revenue' },
  { value: 'occupancy',  label: 'Occupancy' },
  { value: 'overdue',    label: 'Overdue Rent' },
  { value: 'bookings',   label: 'Bookings' },
  { value: 'revenue_mgmt', label: 'Revenue Mgmt →', href: '/reports/revenue' },
  { value: 'custom',    label: 'Custom Builder →', href: '/reports/custom' },
  { value: 'retention', label: 'Retention →',      href: '/reports/retention' },
  { value: 'export',    label: 'Data Export →',    href: '/reports/export' },
  { value: 'feedback',  label: 'Feedback →',        href: '/reports/feedback' },
  { value: 'schedules', label: 'Scheduled →',       href: '/reports/schedules' },
]

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string }>
}) {
  const { report = 'overview' } = await searchParams

  const tenantId = await getServerTenantId()
  if (!tenantId) notFound()

  // Fetch all data in parallel
  const [ytd, revenue6m, methods, occupancy, overdue, bookings] = await Promise.all([
    getYtdSummary(tenantId),
    getRevenueReport(tenantId, 6),
    getPaymentMethodBreakdown(tenantId),
    getOccupancyReport(tenantId),
    getOverdueRent(tenantId),
    getBookingSummary(tenantId),
  ])

  const maxRevenue = Math.max(...revenue6m.map((m) => m.amount), 1)
  const today = new Date().toLocaleDateString('en-GH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Reports</h1>
          <p className="mt-0.5 text-sm text-text-secondary">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-success-subtle px-2.5 py-1 text-xs font-medium text-success">
            Live data
          </span>
        </div>
      </div>

      {/* Headline KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10">
              <TrendingUp className="h-4 w-4 text-brand" />
            </div>
            <p className="text-xs text-text-tertiary">Revenue MTD</p>
          </div>
          <p className="mt-3 font-mono text-xl font-bold text-text-primary">{formatGHS(ytd.mtdTotal)}</p>
          <p className="mt-0.5 text-xs text-text-secondary">YTD: {formatGHS(ytd.ytdTotal)}</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10">
              <BedDouble className="h-4 w-4 text-success" />
            </div>
            <p className="text-xs text-text-tertiary">Occupancy</p>
          </div>
          <p className="mt-3 text-xl font-bold text-text-primary">{occupancy.occupancyPct}%</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            {occupancy.occupied} of {occupancy.total} rooms
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info/10">
              <Users className="h-4 w-4 text-info" />
            </div>
            <p className="text-xs text-text-tertiary">Total Bookings</p>
          </div>
          <p className="mt-3 text-xl font-bold text-text-primary">{bookings.total}</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            {bookings.byStatus['checked_in'] ?? 0} currently checked in
          </p>
        </div>

        <div className="rounded-xl border border-danger/20 bg-danger-subtle p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-danger/10">
              <AlertTriangle className="h-4 w-4 text-danger" />
            </div>
            <p className="text-xs text-danger">Overdue</p>
          </div>
          <p className="mt-3 font-mono text-xl font-bold text-danger">{formatGHS(ytd.overdueTotal)}</p>
          <p className="mt-0.5 text-xs text-danger/70">{overdue.length} bookings outstanding</p>
        </div>
      </div>

      {/* Report tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-1">
        {REPORT_TABS.map((t) => (
          <Link
            key={t.value}
            href={(t as any).href ?? `/reports?report=${t.value}`}
            className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
              report === t.value
                ? 'border-b-2 border-brand text-brand'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
            {t.value === 'overdue' && overdue.length > 0 && (
              <span className="ml-1.5 rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">
                {overdue.length}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* ── OVERVIEW ──────────────────────────────────────────────── */}
      {report === 'overview' && (
        <div className="space-y-6">
          {/* Revenue bar chart */}
          <div className="rounded-xl border border-border bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-text-primary">Revenue — Last 6 Months</h2>
                <p className="text-xs text-text-tertiary mt-0.5">Successful payments only</p>
              </div>
              <BarChart3 className="h-4 w-4 text-text-tertiary" />
            </div>
            <div className="flex items-end gap-3 h-40">
              {revenue6m.map((m) => {
                const heightPct = maxRevenue > 0 ? (m.amount / maxRevenue) * 100 : 0
                return (
                  <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                    <p className="text-[10px] font-mono text-text-tertiary">
                      {m.amount === 0 ? '—'
                        : m.amount >= 100_000
                          ? `GH₵${(m.amount / 100 / 1000).toFixed(1)}k`
                          : formatGHS(m.amount)}
                    </p>
                    <div className="w-full flex items-end" style={{ height: '100px' }}>
                      <div
                        className="w-full rounded-t-md bg-brand transition-all"
                        style={{ height: `${Math.max(heightPct, m.amount > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-text-secondary text-center">{m.label}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Two-column: methods + booking status */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Payment methods */}
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="mb-4 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-text-tertiary" />
                <h2 className="font-semibold text-text-primary">Payment Methods</h2>
                <span className="text-xs text-text-tertiary">(last 12 months)</span>
              </div>
              {methods.length === 0 ? (
                <p className="text-sm text-text-tertiary">No payment data yet.</p>
              ) : (
                <div className="space-y-3">
                  {methods.map((m) => (
                    <div key={m.method}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-text-primary">{METHOD_LABEL[m.method] ?? m.method}</span>
                        <span className="font-mono text-text-secondary">
                          {formatGHS(m.amount)} · {m.pct}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-surface-sunken">
                        <div
                          className="h-2 rounded-full bg-brand"
                          style={{ width: `${m.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Booking status breakdown */}
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="mb-4 flex items-center gap-2">
                <BedDouble className="h-4 w-4 text-text-tertiary" />
                <h2 className="font-semibold text-text-primary">Booking Status</h2>
                <span className="text-xs text-text-tertiary">(all time)</span>
              </div>
              {bookings.total === 0 ? (
                <p className="text-sm text-text-tertiary">No bookings yet.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(bookings.byStatus)
                    .sort((a, b) => b[1] - a[1])
                    .map(([status, count]) => {
                      const pct = bookings.total > 0 ? Math.round((count / bookings.total) * 100) : 0
                      return (
                        <div key={status}>
                          <div className="mb-1 flex justify-between text-xs">
                            <span className="flex items-center gap-1.5 text-text-primary">
                              <span className={`h-2 w-2 rounded-full ${BOOKING_STATUS_COLOR[status] ?? 'bg-border'}`} />
                              {BOOKING_STATUS_LABEL[status] ?? status}
                            </span>
                            <span className="font-mono text-text-secondary">{count} · {pct}%</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-surface-sunken">
                            <div
                              className={`h-2 rounded-full ${BOOKING_STATUS_COLOR[status] ?? 'bg-border'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          </div>

          {/* Overdue preview */}
          {overdue.length > 0 && (
            <div className="rounded-xl border border-danger/20 bg-danger-subtle p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-danger" />
                  <h2 className="font-semibold text-danger">Overdue Rent ({overdue.length})</h2>
                </div>
                <Link
                  href="/reports?report=overdue"
                  className="flex items-center gap-1 text-xs font-medium text-danger hover:underline"
                >
                  View all <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {overdue.slice(0, 5).map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg bg-white/50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {b.occupant?.first_name} {b.occupant?.last_name}
                      </p>
                      <p className="text-xs text-text-secondary">
                        Room {b.room?.room_number} · {b.daysOverdue}d overdue
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-bold text-danger">{formatGHS(b.balance)}</p>
                      <Link
                        href={`/bookings/${b.id}`}
                        className="text-xs text-brand hover:underline"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── REVENUE ───────────────────────────────────────────────── */}
      {report === 'revenue' && (
        <div className="space-y-6">
          {/* Summary row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs text-text-tertiary">This month</p>
              <p className="mt-1 font-mono text-xl font-bold text-text-primary">{formatGHS(ytd.mtdTotal)}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs text-text-tertiary">Year to date</p>
              <p className="mt-1 font-mono text-xl font-bold text-success">{formatGHS(ytd.ytdTotal)}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs text-text-tertiary">Total billed</p>
              <p className="mt-1 font-mono text-xl font-bold text-text-primary">{formatGHS(bookings.totalRevenue)}</p>
              <p className="mt-0.5 text-xs text-text-secondary">All bookings combined</p>
            </div>
          </div>

          {/* Monthly revenue table */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-semibold text-text-primary">Monthly Revenue (Last 6 Months)</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-surface-sunken">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Month</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">Revenue</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary hidden sm:table-cell">vs Previous</th>
                  <th className="px-5 py-3 hidden lg:table-cell" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {revenue6m.map((m, i) => {
                  const prev = revenue6m[i - 1]
                  const change = prev && prev.amount > 0
                    ? ((m.amount - prev.amount) / prev.amount) * 100
                    : null
                  const barPct = maxRevenue > 0 ? (m.amount / maxRevenue) * 100 : 0

                  return (
                    <tr key={m.month} className="hover:bg-surface-raised transition-colors">
                      <td className="px-5 py-3 font-medium text-text-primary">{m.label}</td>
                      <td className="px-5 py-3 text-right font-mono font-semibold text-text-primary">
                        {m.amount > 0 ? formatGHS(m.amount) : <span className="text-text-disabled">—</span>}
                      </td>
                      <td className="px-5 py-3 text-right hidden sm:table-cell">
                        {change !== null ? (
                          <span className={`flex items-center justify-end gap-1 text-xs font-medium ${change >= 0 ? 'text-success' : 'text-danger'}`}>
                            {change >= 0
                              ? <TrendingUp className="h-3 w-3" />
                              : <TrendingDown className="h-3 w-3" />}
                            {Math.abs(change).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-xs text-text-disabled">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell w-48">
                        <div className="h-1.5 w-full rounded-full bg-surface-sunken">
                          <div
                            className="h-1.5 rounded-full bg-brand"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Payment method table */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-semibold text-text-primary">Revenue by Payment Method</h2>
              <p className="text-xs text-text-tertiary mt-0.5">Last 12 months</p>
            </div>
            {methods.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-text-tertiary">No payment data yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface-sunken">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Method</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">Amount</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">Share</th>
                    <th className="px-5 py-3 hidden md:table-cell" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {methods.map((m) => (
                    <tr key={m.method} className="hover:bg-surface-raised transition-colors">
                      <td className="px-5 py-3 font-medium text-text-primary">{METHOD_LABEL[m.method] ?? m.method}</td>
                      <td className="px-5 py-3 text-right font-mono text-text-primary">{formatGHS(m.amount)}</td>
                      <td className="px-5 py-3 text-right text-text-secondary">{m.pct}%</td>
                      <td className="px-5 py-3 hidden md:table-cell w-40">
                        <div className="h-1.5 w-full rounded-full bg-surface-sunken">
                          <div className="h-1.5 rounded-full bg-brand" style={{ width: `${m.pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── OCCUPANCY ─────────────────────────────────────────────── */}
      {report === 'occupancy' && (
        <div className="space-y-6">
          {/* Room status summary */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Total rooms',  value: occupancy.total,    color: 'text-text-primary', bg: 'bg-surface' },
              { label: 'Occupied',     value: occupancy.occupied, color: 'text-success',      bg: 'bg-success-subtle border-success/20' },
              { label: 'Reserved',     value: occupancy.reserved, color: 'text-warning-fg',   bg: 'bg-warning-subtle border-warning/20' },
              { label: 'Available',    value: occupancy.available,color: 'text-info',          bg: 'bg-info-subtle border-info/20' },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl border border-border p-4 ${s.bg}`}>
                <p className="text-xs text-text-tertiary">{s.label}</p>
                <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Occupancy rate visual */}
          <div className="rounded-xl border border-border bg-surface p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-text-primary">Overall Occupancy Rate</h2>
              <span className="text-2xl font-bold text-text-primary">{occupancy.occupancyPct}%</span>
            </div>
            <div className="h-4 w-full rounded-full bg-surface-sunken overflow-hidden">
              <div
                className="h-4 rounded-full bg-success transition-all"
                style={{ width: `${occupancy.occupancyPct}%` }}
              />
            </div>
            <div className="mt-3 flex gap-6 text-xs text-text-secondary">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" />Occupied ({occupancy.occupied})</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning" />Reserved ({occupancy.reserved})</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-border" />Available ({occupancy.available})</span>
            </div>
          </div>

          {/* By category */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-semibold text-text-primary">Occupancy by Room Category</h2>
            </div>
            {occupancy.byCategory.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-text-tertiary">No room data yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface-sunken">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Category</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-text-tertiary">Total</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-text-tertiary">Occupied</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">Rate</th>
                    <th className="px-5 py-3 hidden md:table-cell" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {occupancy.byCategory.map((c) => (
                    <tr key={c.name} className="hover:bg-surface-raised transition-colors">
                      <td className="px-5 py-3 font-medium text-text-primary">{c.name}</td>
                      <td className="px-5 py-3 text-center text-text-secondary">{c.total}</td>
                      <td className="px-5 py-3 text-center text-text-secondary">{c.occupied}</td>
                      <td className="px-5 py-3 text-right font-semibold">
                        <span className={c.pct >= 80 ? 'text-success' : c.pct >= 50 ? 'text-warning-fg' : 'text-danger'}>
                          {c.pct}%
                        </span>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell w-40">
                        <div className="h-1.5 w-full rounded-full bg-surface-sunken">
                          <div
                            className={`h-1.5 rounded-full ${c.pct >= 80 ? 'bg-success' : c.pct >= 50 ? 'bg-warning' : 'bg-danger'}`}
                            style={{ width: `${c.pct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Housekeeping status */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="font-semibold text-text-primary mb-4">Housekeeping Status</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(occupancy.hkStatus).map(([status, count]) => (
                <div key={status} className="rounded-lg border border-border bg-surface-raised p-3 text-center">
                  <div className={`mx-auto mb-2 h-3 w-3 rounded-full ${HK_COLOR[status] ?? 'bg-border'}`} />
                  <p className="text-xs text-text-secondary">{HK_LABEL[status] ?? status}</p>
                  <p className="mt-0.5 text-lg font-bold text-text-primary">{count}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── OVERDUE RENT ──────────────────────────────────────────── */}
      {report === 'overdue' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="rounded-xl border border-danger/20 bg-danger-subtle p-5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-danger" />
              <div>
                <p className="font-semibold text-danger">
                  {formatGHS(ytd.overdueTotal)} outstanding across {overdue.length} booking{overdue.length !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-danger/70 mt-0.5">
                  Active occupants who have passed their check-in date with unpaid or partial balances
                </p>
              </div>
            </div>
          </div>

          {overdue.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-subtle">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <p className="font-medium text-text-primary">All clear — no overdue rent</p>
              <p className="text-sm text-text-secondary">All active occupants are up to date on payments.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-surface-sunken">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Occupant</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary hidden md:table-cell">Room</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary hidden lg:table-cell">Check-in</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-text-tertiary">Days Overdue</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">Billed</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">Paid</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">Balance</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {overdue.map((b) => (
                    <tr key={b.id} className="hover:bg-surface-raised transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-text-primary">
                          {b.occupant?.first_name} {b.occupant?.last_name}
                        </p>
                        {b.occupant?.student_id && (
                          <p className="text-xs text-text-tertiary">{b.occupant.student_id}</p>
                        )}
                        {b.occupant?.phone && (
                          <p className="text-xs text-text-tertiary">{b.occupant.phone}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-secondary hidden md:table-cell">
                        Room {b.room?.room_number}
                        {b.room?.block ? ` · Block ${b.room.block}` : ''}
                      </td>
                      <td className="px-4 py-3 text-text-secondary text-xs hidden lg:table-cell whitespace-nowrap">
                        {new Date(b.check_in_date).toLocaleDateString('en-GH', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          b.daysOverdue > 30 ? 'bg-danger text-white' :
                          b.daysOverdue > 7  ? 'bg-danger-subtle text-danger' :
                          'bg-warning-subtle text-warning-fg'
                        }`}>
                          {b.daysOverdue}d
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-text-secondary">{formatGHS(b.final_amount)}</td>
                      <td className="px-4 py-3 text-right font-mono text-success">{formatGHS(b.paid_amount)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-danger">{formatGHS(b.balance)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/bookings/${b.id}`}
                          className="text-xs font-medium text-brand hover:text-brand-hover transition-colors"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border bg-surface-sunken">
                  <tr>
                    <td colSpan={6} className="px-4 py-3 text-right text-sm font-semibold text-text-primary">
                      Total outstanding
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-danger">
                      {formatGHS(ytd.overdueTotal)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── BOOKINGS ──────────────────────────────────────────────── */}
      {report === 'bookings' && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Object.entries(bookings.byStatus).map(([status, count]) => (
              <div key={status} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`h-2 w-2 rounded-full ${BOOKING_STATUS_COLOR[status] ?? 'bg-border'}`} />
                  <p className="text-xs text-text-tertiary">{BOOKING_STATUS_LABEL[status] ?? status}</p>
                </div>
                <p className="text-xl font-bold text-text-primary">{count}</p>
                <p className="text-xs text-text-secondary mt-0.5">
                  {bookings.total > 0 ? Math.round((count / bookings.total) * 100) : 0}% of total
                </p>
              </div>
            ))}
          </div>

          {/* Financials */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs text-text-tertiary">Total billed</p>
              <p className="mt-1 font-mono text-lg font-bold text-text-primary">{formatGHS(bookings.totalRevenue)}</p>
            </div>
            <div className="rounded-xl border border-success/20 bg-success-subtle p-4">
              <p className="text-xs text-success">Total collected</p>
              <p className="mt-1 font-mono text-lg font-bold text-success">{formatGHS(bookings.totalPaid)}</p>
              <p className="mt-0.5 text-xs text-success/70">
                {bookings.totalRevenue > 0 ? Math.round((bookings.totalPaid / bookings.totalRevenue) * 100) : 0}% collection rate
              </p>
            </div>
            <div className="rounded-xl border border-danger/20 bg-danger-subtle p-4">
              <p className="text-xs text-danger">Outstanding</p>
              <p className="mt-1 font-mono text-lg font-bold text-danger">{formatGHS(bookings.totalOutstanding)}</p>
            </div>
          </div>

          {/* Booking source */}
          {Object.keys(bookings.bySource).length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h2 className="font-semibold text-text-primary mb-4">Booking Source</h2>
              <div className="space-y-3">
                {Object.entries(bookings.bySource)
                  .sort((a, b) => b[1] - a[1])
                  .map(([source, count]) => {
                    const pct = bookings.total > 0 ? Math.round((count / bookings.total) * 100) : 0
                    const label = SOURCE_LABEL[source] ?? source
                    return (
                      <div key={source}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-text-primary capitalize">{label}</span>
                          <span className="font-mono text-text-secondary">{count} · {pct}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-surface-sunken">
                          <div className="h-2 rounded-full bg-brand" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
