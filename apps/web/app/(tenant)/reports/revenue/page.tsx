import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, TrendingUp, BedDouble, DollarSign, Zap, Info } from 'lucide-react'

import { getRevenueMetrics } from '@/lib/data/reports'
import { getServerTenantId } from '@/lib/auth/tenant'
import { notFound } from 'next/navigation'
import { formatGHS } from '@/lib/utils'

export const metadata: Metadata = { title: 'Revenue Management' }

export default async function RevenueManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ months?: string }>
}) {
  const { months: monthsParam } = await searchParams
  const months = Math.min(12, Math.max(3, parseInt(monthsParam ?? '6') || 6))

  const tenantId = await getServerTenantId()
  if (!tenantId) notFound()

  const data = await getRevenueMetrics(tenantId, months)

  // Headline KPIs from the most recent full month
  const latest   = data[data.length - 1]
  const previous = data[data.length - 2]

  function delta(curr: number, prev: number) {
    if (!prev) return null
    const d = ((curr - prev) / prev) * 100
    return { pct: Math.abs(Math.round(d)), up: d >= 0 }
  }

  const revparDelta    = previous ? delta(latest.revpar,       previous.revpar)       : null
  const adrDelta       = previous ? delta(latest.adr,          previous.adr)          : null
  const occupancyDelta = previous ? delta(latest.occupancyPct, previous.occupancyPct) : null
  const yieldDelta     = previous ? delta(latest.yieldPct,     previous.yieldPct)     : null

  // Chart bars — relative to max revenue in dataset
  const maxRevenue = Math.max(1, ...data.map((d) => d.revenue))

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link href="/reports" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" /> Reports
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="text-sm font-medium text-text-primary">Revenue Management</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Revenue Management</h1>
          <p className="mt-1 text-sm text-text-secondary">
            RevPAR · ADR · Occupancy · Yield — hospitality performance metrics
          </p>
        </div>
        {/* Period selector */}
        <form method="GET" className="flex items-center gap-2">
          <label className="text-xs text-text-secondary">Period</label>
          <select
            name="months"
            defaultValue={months}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-brand focus:outline-none"
          >
            <option value="3">3 months</option>
            <option value="6">6 months</option>
            <option value="12">12 months</option>
          </select>
          <button type="submit" className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity">
            Apply
          </button>
        </form>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="RevPAR"
          sublabel="Rev. per available room"
          value={formatGHS(latest.revpar)}
          delta={revparDelta}
          icon={TrendingUp}
          color="text-brand"
          tooltip="Revenue ÷ Total available room-nights. Measures how well you're filling rooms at the right price."
        />
        <KpiCard
          label="ADR"
          sublabel="Avg. daily rate"
          value={formatGHS(latest.adr)}
          delta={adrDelta}
          icon={DollarSign}
          color="text-success"
          tooltip="Revenue ÷ Booked room-nights. The average price paid per night actually sold."
        />
        <KpiCard
          label="Occupancy"
          sublabel="Booked room-nights"
          value={`${latest.occupancyPct}%`}
          delta={occupancyDelta}
          icon={BedDouble}
          color="text-info"
          tooltip="Booked room-nights ÷ Available room-nights. How full your property is."
        />
        <KpiCard
          label="Yield"
          sublabel="vs. max potential"
          value={`${latest.yieldPct}%`}
          delta={yieldDelta}
          icon={Zap}
          color={latest.yieldPct >= 70 ? 'text-success' : latest.yieldPct >= 40 ? 'text-warning' : 'text-danger'}
          tooltip="RevPAR ÷ maximum possible RevPAR (100% occupancy at your top rate). Overall revenue efficiency."
        />
      </div>

      {/* Revenue bar chart */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-text-primary">Monthly Revenue</h2>
          <p className="mt-0.5 text-xs text-text-secondary">Payments collected per month</p>
        </div>
        <div className="px-5 py-6">
          <div className="flex items-end gap-3 h-40">
            {data.map((m) => {
              const heightPct = maxRevenue > 0 ? (m.revenue / maxRevenue) * 100 : 0
              return (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1 min-w-0">
                  <span className="text-[10px] text-text-tertiary currency-amount truncate w-full text-center">
                    {m.revenue > 0 ? formatGHS(m.revenue) : '—'}
                  </span>
                  <div className="w-full flex items-end" style={{ height: '100px' }}>
                    <div
                      className="w-full rounded-t-md bg-brand/80 hover:bg-brand transition-colors"
                      style={{ height: `${Math.max(2, heightPct)}%` }}
                      title={`${m.label}: ${formatGHS(m.revenue)}`}
                    />
                  </div>
                  <span className="text-[10px] text-text-tertiary truncate w-full text-center">{m.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Metrics table */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-text-primary">Monthly Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-raised">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Month</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">Revenue</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">RevPAR</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">ADR</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">Occupancy</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">Yield</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...data].reverse().map((m) => (
                <tr key={m.month} className="hover:bg-surface-raised transition-colors">
                  <td className="px-4 py-3 font-medium text-text-primary">{m.label}</td>
                  <td className="px-4 py-3 text-right currency-amount text-text-primary">{formatGHS(m.revenue)}</td>
                  <td className="px-4 py-3 text-right currency-amount text-text-secondary">{formatGHS(m.revpar)}</td>
                  <td className="px-4 py-3 text-right currency-amount text-text-secondary">{formatGHS(m.adr)}</td>
                  <td className="px-4 py-3 text-right">
                    <OccupancyBar pct={m.occupancyPct} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <YieldBadge pct={m.yieldPct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Yield improvement hints */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Zap className="h-4 w-4 text-brand" /> Yield Improvement Suggestions
        </h2>
        <div className="space-y-3">
          {latest.occupancyPct < 70 && (
            <Suggestion
              title="Low occupancy — consider promotional pricing"
              detail={`Your occupancy is ${latest.occupancyPct}%. Offering a short-term discount or early-bird rate could fill empty rooms and improve RevPAR.`}
              severity="warning"
            />
          )}
          {latest.occupancyPct >= 90 && (
            <Suggestion
              title="High occupancy — room to raise rates"
              detail={`You're at ${latest.occupancyPct}% occupancy. Consider a modest rate increase on your highest-demand room categories to improve ADR without losing many bookings.`}
              severity="info"
            />
          )}
          {latest.yieldPct < 30 && (
            <Suggestion
              title="Yield is below 30% — review your base rates"
              detail="Your actual revenue is well below your maximum potential. Check whether base rates are set correctly in Room Categories."
              severity="critical"
            />
          )}
          {latest.adr > 0 && latest.revpar > 0 && latest.occupancyPct >= 70 && latest.yieldPct >= 50 && (
            <Suggestion
              title="Performance looks healthy"
              detail={`RevPAR of ${formatGHS(latest.revpar)} with ${latest.occupancyPct}% occupancy and ${latest.yieldPct}% yield is solid. Consider tracking week-by-week for seasonal patterns.`}
              severity="success"
            />
          )}
          {data.every((m) => m.revenue === 0) && (
            <Suggestion
              title="No payments recorded yet"
              detail="Revenue metrics will populate once booking payments are marked as paid."
              severity="info"
            />
          )}
        </div>
      </div>

      {/* Metric definitions */}
      <div className="rounded-xl border border-border bg-surface-raised px-5 py-4 text-xs text-text-secondary space-y-1.5">
        <p className="font-medium text-text-primary flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> Metric definitions</p>
        <p><strong>RevPAR</strong> = Revenue ÷ (Total rooms × Days in month)</p>
        <p><strong>ADR</strong> = Revenue ÷ Booked room-nights</p>
        <p><strong>Occupancy</strong> = Booked room-nights ÷ Available room-nights</p>
        <p><strong>Yield</strong> = RevPAR ÷ (Top nightly rate) — how close you are to maximum possible revenue</p>
        <p className="text-text-tertiary">Rates with weekly/monthly/semester units are normalised to a per-night equivalent for calculation.</p>
      </div>
    </div>
  )
}

function KpiCard({
  label, sublabel, value, delta, icon: Icon, color, tooltip,
}: {
  label: string; sublabel: string; value: string
  delta: { pct: number; up: boolean } | null
  icon: React.ElementType; color: string; tooltip: string
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-2" title={tooltip}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-secondary">{label}</p>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <p className={`text-xl font-bold currency-amount ${color}`}>{value}</p>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-text-tertiary">{sublabel}</p>
        {delta && (
          <span className={`text-[11px] font-medium ${delta.up ? 'text-success' : 'text-danger'}`}>
            {delta.up ? '▲' : '▼'} {delta.pct}%
          </span>
        )}
      </div>
    </div>
  )
}

function OccupancyBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-16 rounded-full bg-border overflow-hidden">
        <div
          className={`h-full rounded-full ${pct >= 70 ? 'bg-success' : pct >= 40 ? 'bg-warning' : 'bg-danger'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-text-secondary w-10 text-right">{pct}%</span>
    </div>
  )
}

function YieldBadge({ pct }: { pct: number }) {
  const cls = pct >= 70
    ? 'bg-success/10 text-success'
    : pct >= 40
    ? 'bg-warning/10 text-warning'
    : 'bg-danger/10 text-danger'
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {pct}%
    </span>
  )
}

function Suggestion({ title, detail, severity }: { title: string; detail: string; severity: 'info' | 'warning' | 'critical' | 'success' }) {
  const styles = {
    info:     'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
    warning:  'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    critical: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300',
    success:  'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300',
  }
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${styles[severity]}`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-0.5 opacity-80">{detail}</p>
    </div>
  )
}
