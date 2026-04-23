import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Users, Banknote, Smartphone } from 'lucide-react'
import { getServerTenantId } from '@/lib/auth/tenant'
import { getStaffRevenue } from '@/lib/data/staff-revenue'
import { formatGHS } from '@/lib/utils'
import { notFound } from 'next/navigation'

export const metadata: Metadata = { title: 'Staff Revenue Report' }

const RANGE_OPTIONS = [
  { value: 'today',      label: 'Today' },
  { value: 'this_week',  label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
]

function getDateRange(range: string) {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  switch (range) {
    case 'today':
      return { from: `${today}T00:00:00`, to: `${today}T23:59:59` }
    case 'this_week': {
      const day = now.getDay()
      const mon = new Date(now)
      mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
      return { from: `${mon.toISOString().slice(0, 10)}T00:00:00`, to: `${today}T23:59:59` }
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end   = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: start.toISOString(), to: end.toISOString() }
    }
    default: { // this_month
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: start.toISOString(), to: `${today}T23:59:59` }
    }
  }
}

export default async function StaffRevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const tenantId = await getServerTenantId()
  if (!tenantId) notFound()

  const { range = 'this_month' } = await searchParams
  const { from, to } = getDateRange(range)
  const staff = await getStaffRevenue(tenantId, from, to)

  const grandTotal   = staff.reduce((s, r) => s + r.total, 0)
  const grandCash    = staff.reduce((s, r) => s + r.cashTotal, 0)
  const grandDigital = staff.reduce((s, r) => s + r.digitalTotal, 0)
  const grandCount   = staff.reduce((s, r) => s + r.paymentsCount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/reports"
            className="mb-2 inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft className="h-3 w-3" /> Reports
          </Link>
          <h1 className="text-2xl font-bold text-text-primary">Staff Revenue Attribution</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            Who collected how much — cash vs digital breakdown
          </p>
        </div>
      </div>

      {/* Date range filter */}
      <div className="flex flex-wrap gap-2">
        {RANGE_OPTIONS.map((opt) => (
          <Link
            key={opt.value}
            href={`/reports/staff-revenue?range=${opt.value}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              range === opt.value
                ? 'bg-brand text-white'
                : 'bg-surface border border-border text-text-secondary hover:bg-surface-sunken'
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10">
              <Users className="h-4 w-4 text-brand" />
            </div>
            <p className="text-xs text-text-tertiary">Staff</p>
          </div>
          <p className="mt-2 text-xl font-bold text-text-primary">{staff.length}</p>
          <p className="text-xs text-text-secondary">{grandCount} payments total</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-tertiary">Total Collected</p>
          <p className="mt-2 font-mono text-xl font-bold text-text-primary">{formatGHS(grandTotal)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-success" />
            <p className="text-xs text-text-tertiary">Cash</p>
          </div>
          <p className="mt-2 font-mono text-xl font-bold text-success">{formatGHS(grandCash)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-brand" />
            <p className="text-xs text-text-tertiary">Digital</p>
          </div>
          <p className="mt-2 font-mono text-xl font-bold text-brand">{formatGHS(grandDigital)}</p>
        </div>
      </div>

      {/* Staff table */}
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
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-sunken">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Staff</th>
                <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-text-tertiary">Payments</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">Cash</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">Digital</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">Total</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary hidden md:table-cell">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {staff.map((s) => {
                const sharePct = grandTotal > 0 ? Math.round((s.total / grandTotal) * 100) : 0
                return (
                  <tr key={s.staffId} className="hover:bg-surface-raised transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-text-primary">{s.staffName}</p>
                      {s.staffEmail && (
                        <p className="text-xs text-text-tertiary">{s.staffEmail}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center text-text-secondary">{s.paymentsCount}</td>
                    <td className="px-5 py-3 text-right font-mono text-success">{formatGHS(s.cashTotal)}</td>
                    <td className="px-5 py-3 text-right font-mono text-brand">{formatGHS(s.digitalTotal)}</td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-text-primary">{formatGHS(s.total)}</td>
                    <td className="px-5 py-3 text-right hidden md:table-cell">
                      <div className="inline-flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-surface-sunken">
                          <div className="h-1.5 rounded-full bg-brand" style={{ width: `${sharePct}%` }} />
                        </div>
                        <span className="text-xs text-text-secondary">{sharePct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t-2 border-border bg-surface-sunken">
              <tr>
                <td className="px-5 py-3 font-semibold text-text-primary">Total</td>
                <td className="px-5 py-3 text-center font-semibold text-text-primary">{grandCount}</td>
                <td className="px-5 py-3 text-right font-mono font-bold text-success">{formatGHS(grandCash)}</td>
                <td className="px-5 py-3 text-right font-mono font-bold text-brand">{formatGHS(grandDigital)}</td>
                <td className="px-5 py-3 text-right font-mono font-bold text-text-primary">{formatGHS(grandTotal)}</td>
                <td className="px-5 py-3 hidden md:table-cell" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
