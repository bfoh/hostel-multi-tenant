import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Users, ChevronRight } from 'lucide-react'
import { getServerTenantId } from '@/lib/auth/tenant'
import { getStaffRevenue, getStaffTransactions } from '@/lib/data/staff-revenue'
import { formatGHS } from '@/lib/utils'
import { notFound } from 'next/navigation'
import { PAYMENT_METHOD_LABEL as METHOD_LABEL } from '@/lib/payments/methods'
import { getArchivePeriods, type ArchiveMode } from '@/lib/reports/period-archive'
import { PeriodArchivePicker } from '@/components/reports/period-archive-picker'

export const metadata: Metadata = { title: 'Staff Revenue Report' }

const ROW_GRID = 'grid grid-cols-[1fr_80px_100px_100px_100px] gap-2 sm:grid-cols-[1fr_80px_100px_100px_100px_96px]'

export default async function StaffRevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ archiveMode?: string; archiveIdx?: string }>
}) {
  const tenantId = await getServerTenantId()
  if (!tenantId) notFound()

  const sp = await searchParams
  const archiveMode: ArchiveMode = sp.archiveMode === 'month' || sp.archiveMode === 'year' ? sp.archiveMode : 'week'
  const periods = getArchivePeriods(archiveMode)
  const archiveIdx = Math.min(Math.max(parseInt(sp.archiveIdx ?? '0', 10) || 0, 0), periods.length - 1)
  const selectedPeriod = periods[archiveIdx]

  const from = `${selectedPeriod.from}T00:00:00`
  const to   = `${selectedPeriod.to}T23:59:59`
  const staff = await getStaffRevenue(tenantId, from, to)

  // Charge lines per staff (for the expanded row's "Payment" column table) —
  // fetched up front since the row detail is plain HTML <details>, not
  // client-side lazy-loaded.
  const chargesByStaff = new Map<string, Awaited<ReturnType<typeof getStaffTransactions>>>()
  await Promise.all(
    staff.map(async (s) => {
      const txns = await getStaffTransactions(tenantId, s.staffId, from, to)
      chargesByStaff.set(s.staffId, txns.filter((t) => t.source === 'charge'))
    }),
  )

  const grandTotal        = staff.reduce((s, r) => s + r.total, 0)
  const grandRoomRevenue  = staff.reduce((s, r) => s + r.roomRevenue, 0)
  const grandChargesTotal = staff.reduce((s, r) => s + r.chargesRevenue, 0)
  const grandCount        = staff.reduce((s, r) => s + r.paymentsCount, 0)

  const grandMethodTotals = new Map<string, { count: number; amount: number }>()
  for (const s of staff) {
    for (const [method, v] of Object.entries(s.methodTotals)) {
      if (!v) continue
      const e = grandMethodTotals.get(method) ?? { count: 0, amount: 0 }
      e.count += v.count
      e.amount += v.amount
      grandMethodTotals.set(method, e)
    }
  }
  const methodBars = Array.from(grandMethodTotals.entries())
    .sort((a, b) => b[1].amount - a[1].amount)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/reports"
            className="mb-2 inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft className="h-3 w-3" /> Reports
          </Link>
          <h1 className="text-2xl font-bold text-text-primary">Staff Revenue Attribution</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            Who collected how much, broken down by payment method
          </p>
        </div>
      </div>

      {/* Period archive picker */}
      <div>
        <PeriodArchivePicker
          basePath="/reports/staff-revenue"
          mode={archiveMode}
          periods={periods}
          selectedIdx={archiveIdx}
        />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10">
              <Users className="h-4 w-4 text-brand" />
            </div>
            <p className="text-xs text-text-tertiary">Staff</p>
          </div>
          <p className="mt-2 text-xl font-bold text-text-primary">{staff.length}</p>
          <p className="text-xs text-text-secondary">{grandCount} transactions total</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-tertiary">Total Collected</p>
          <p className="mt-2 font-mono text-xl font-bold text-text-primary">{formatGHS(grandTotal)}</p>
          <p className="text-xs text-text-secondary">
            {formatGHS(grandRoomRevenue)} room · {formatGHS(grandChargesTotal)} charges
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="mb-2 text-xs text-text-tertiary">By method</p>
          {methodBars.length === 0 ? (
            <p className="text-sm text-text-tertiary">—</p>
          ) : (
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-sunken">
              {methodBars.map(([method, v], i) => (
                <div
                  key={method}
                  title={`${METHOD_LABEL[method as keyof typeof METHOD_LABEL] ?? method}: ${formatGHS(v.amount)}`}
                  className={i % 2 === 0 ? 'h-full bg-brand' : 'h-full bg-success'}
                  style={{ width: `${grandTotal > 0 ? (v.amount / grandTotal) * 100 : 0}%` }}
                />
              ))}
            </div>
          )}
          <p className="mt-2 truncate text-xs text-text-secondary">
            {methodBars.slice(0, 3).map(([m]) => METHOD_LABEL[m as keyof typeof METHOD_LABEL] ?? m).join(' · ')}
          </p>
        </div>
      </div>

      {/* Staff list */}
      {staff.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <Users className="h-8 w-8 text-text-disabled" />
          <p className="font-medium text-text-primary">No staff payments recorded</p>
          <p className="text-sm text-text-secondary">
            Payments with a &quot;received_by&quot; field will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className={`${ROW_GRID} bg-surface-sunken px-5 py-3 text-xs font-semibold uppercase tracking-wide text-text-tertiary`}>
            <span>Staff</span>
            <span className="text-center">Txns</span>
            <span className="text-right">Room Rev.</span>
            <span className="text-right">Charges</span>
            <span className="text-right">Total</span>
            <span className="hidden text-right sm:block">Share</span>
          </div>

          <div className="divide-y divide-border">
            {staff.map((s) => {
              const sharePct = grandTotal > 0 ? Math.round((s.total / grandTotal) * 100) : 0
              const methods = Object.entries(s.methodTotals)
                .filter((e): e is [string, { count: number; amount: number }] => !!e[1])
                .sort((a, b) => b[1].amount - a[1].amount)
              const charges = chargesByStaff.get(s.staffId) ?? []

              return (
                <details key={s.staffId} className="group">
                  <summary
                    className={`${ROW_GRID} cursor-pointer list-none items-center px-5 py-3 transition-colors hover:bg-surface-raised [&::-webkit-details-marker]:hidden`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary transition-transform group-open:rotate-90" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-text-primary">{s.staffName}</p>
                        {s.staffEmail && <p className="truncate text-xs text-text-tertiary">{s.staffEmail}</p>}
                      </div>
                    </div>
                    <span className="text-center text-text-secondary">{s.paymentsCount}</span>
                    <span className="text-right font-mono text-text-primary">{formatGHS(s.roomRevenue)}</span>
                    <span className="text-right font-mono text-text-primary">{formatGHS(s.chargesRevenue)}</span>
                    <span className="text-right font-mono font-bold text-text-primary">{formatGHS(s.total)}</span>
                    <span className="hidden items-center justify-end gap-2 sm:flex">
                      <span className="h-1.5 w-12 rounded-full bg-surface-sunken">
                        <span className="block h-1.5 rounded-full bg-brand" style={{ width: `${sharePct}%` }} />
                      </span>
                      <span className="text-xs text-text-secondary">{sharePct}%</span>
                    </span>
                  </summary>

                  <div className="space-y-4 border-t border-border bg-surface-sunken/50 px-5 py-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg bg-surface p-3">
                        <p className="text-[11px] uppercase tracking-wide text-text-tertiary">Room Rev.</p>
                        <p className="mt-0.5 font-mono font-semibold text-text-primary">{formatGHS(s.roomRevenue)}</p>
                      </div>
                      <div className="rounded-lg bg-surface p-3">
                        <p className="text-[11px] uppercase tracking-wide text-text-tertiary">Add&apos;l Charges</p>
                        <p className="mt-0.5 font-mono font-semibold text-text-primary">{formatGHS(s.chargesRevenue)}</p>
                      </div>
                      <div className="rounded-lg bg-success-subtle p-3">
                        <p className="text-[11px] uppercase tracking-wide text-success">Grand Total</p>
                        <p className="mt-0.5 font-mono font-semibold text-success">{formatGHS(s.total)}</p>
                      </div>
                    </div>

                    {methods.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                          Payment Method Breakdown
                        </p>
                        <div className="space-y-2">
                          {methods.map(([method, v]) => {
                            const pct = s.total > 0 ? Math.round((v.amount / s.total) * 100) : 0
                            return (
                              <div key={method}>
                                <div className="mb-0.5 flex justify-between text-xs">
                                  <span className="text-text-primary">
                                    {METHOD_LABEL[method as keyof typeof METHOD_LABEL] ?? method}
                                    <span className="text-text-tertiary"> · {v.count}</span>
                                  </span>
                                  <span className="font-mono text-text-secondary">{formatGHS(v.amount)} · {pct}%</span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-surface">
                                  <div className="h-1.5 rounded-full bg-brand" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {charges.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">Charges</p>
                        <div className="overflow-hidden rounded-lg border border-border">
                          <table className="w-full text-xs">
                            <thead className="bg-surface">
                              <tr>
                                <th className="px-3 py-2 text-left text-text-tertiary">Description</th>
                                <th className="px-3 py-2 text-left text-text-tertiary">Booking</th>
                                <th className="px-3 py-2 text-right text-text-tertiary">Amount</th>
                                <th className="px-3 py-2 text-left text-text-tertiary">Payment</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {charges.map((c) => (
                                <tr key={c.id}>
                                  <td className="px-3 py-2 text-text-primary">{c.description ?? '—'}</td>
                                  <td className="px-3 py-2 text-text-secondary">{c.bookingRef}</td>
                                  <td className="px-3 py-2 text-right font-mono text-text-primary">{formatGHS(c.amount)}</td>
                                  <td className="px-3 py-2 text-text-secondary">
                                    {METHOD_LABEL[c.method as keyof typeof METHOD_LABEL] ?? c.method}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              )
            })}
          </div>

          <div className={`${ROW_GRID} border-t-2 border-border bg-surface-sunken px-5 py-3`}>
            <span className="font-semibold text-text-primary">Total</span>
            <span className="text-center font-semibold text-text-primary">{grandCount}</span>
            <span className="text-right font-mono font-bold text-text-primary">{formatGHS(grandRoomRevenue)}</span>
            <span className="text-right font-mono font-bold text-text-primary">{formatGHS(grandChargesTotal)}</span>
            <span className="text-right font-mono font-bold text-text-primary">{formatGHS(grandTotal)}</span>
            <span className="hidden sm:block" />
          </div>
        </div>
      )}
    </div>
  )
}
