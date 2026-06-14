import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getDailyReport,
  getTenantToday,
  listDailyReports,
  rollupReports,
  deltaVs,
  type DailyReport,
  type DailyRollup,
} from '@/lib/reports/daily'
import { formatGHS } from '@/lib/utils'
import {
  ArrowUpRight, ArrowDownRight, RefreshCw, AlertTriangle,
  TrendingUp, Bed, Coffee, Dumbbell, Shirt, Wrench, ShoppingBag, SprayCan, FileWarning, ChevronRight,
} from 'lucide-react'
import { RefreshButton } from '@/components/dashboard/refresh-button'
import { ExportCsvButton } from '@/components/dashboard/export-csv-button'

export const metadata: Metadata = { title: 'Owner dashboard' }
export const dynamic = 'force-dynamic'

type TabKey = 'today' | 'yesterday' | 'week' | 'month'

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function OwnerDashboardPage({ searchParams }: PageProps) {
  const sp  = await searchParams
  const tab: TabKey = (['today','yesterday','week','month'] as const).includes(sp.tab as TabKey)
    ? (sp.tab as TabKey)
    : 'today'

  const h        = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) redirect('/login')

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) redirect('/login')

  const today = await getTenantToday(tenantId)
  const yesterday = isoMinus(today, 1)

  // Fetch primary + comparison data based on selected tab
  let primary: DailyReport | null = null
  let comparison: DailyReport | null = null
  let rangeRows: DailyReport[] = []
  let prevRangeRows: DailyReport[] = []
  let rollup: DailyRollup | null = null
  let prevRollup: DailyRollup | null = null
  let primaryDate = today
  let rangeLabel = ''
  let exportFrom = today
  let exportTo   = today

  if (tab === 'today') {
    primary    = await getDailyReport(tenantId, today)
    comparison = await getDailyReport(tenantId, yesterday)
    primaryDate = today
    rangeLabel = 'Today'
    exportFrom = today; exportTo = today
  } else if (tab === 'yesterday') {
    primary    = await getDailyReport(tenantId, yesterday)
    comparison = await getDailyReport(tenantId, isoMinus(today, 2))
    primaryDate = yesterday
    rangeLabel = 'Yesterday'
    exportFrom = yesterday; exportTo = yesterday
  } else if (tab === 'week') {
    const start7   = isoMinus(today, 6)
    const start14  = isoMinus(today, 13)
    const end14    = isoMinus(today, 7)
    rangeRows      = await listDailyReports(tenantId, start7, today)
    prevRangeRows  = await listDailyReports(tenantId, start14, end14)
    rollup         = rollupReports(rangeRows)
    prevRollup     = rollupReports(prevRangeRows)
    rangeLabel     = `Last 7 days · ${start7} → ${today}`
    exportFrom = start7; exportTo = today
  } else {
    const start30  = isoMinus(today, 29)
    const start60  = isoMinus(today, 59)
    const end60    = isoMinus(today, 30)
    rangeRows      = await listDailyReports(tenantId, start30, today)
    prevRangeRows  = await listDailyReports(tenantId, start60, end60)
    rollup         = rollupReports(rangeRows)
    prevRollup     = rollupReports(prevRangeRows)
    rangeLabel     = `Last 30 days · ${start30} → ${today}`
    exportFrom = start30; exportTo = today
  }

  const ranged = tab === 'week' || tab === 'month'

  // Tenant name for header
  const { data: tenantRow } = await createAdminClient()
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single()
  const tenantName = (tenantRow as any)?.name ?? 'Hostel'

  // Same-day-last-week for the secondary delta on today/yesterday tabs
  let sdlwDelta = 0
  if (!ranged && primary) {
    const sdlw = await getDailyReport(tenantId, isoMinus(primaryDate, 7))
    if (sdlw) sdlwDelta = primary.revenue_total - sdlw.revenue_total
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
          {tenantName} · Owner view
        </p>
        <h1 className="text-2xl font-bold text-text-primary">Daily operations</h1>
        <p className="text-sm text-text-secondary">{rangeLabel}</p>
      </header>

      <DateTabs current={tab} />

      {/* Hero */}
      <HeroCard
        primary={primary}
        comparison={comparison}
        rollup={rollup}
        prevRollup={prevRollup}
        ranged={ranged}
        sdlwDelta={sdlwDelta}
      />

      {/* KPI strip */}
      <KpiStrip
        primary={primary}
        rollup={rollup}
        ranged={ranged}
      />

      {/* Revenue breakdown */}
      <RevenueByMethod primary={primary} rollup={rollup} ranged={ranged} />

      {/* Two-column on desktop: activity + open issues */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ActivityCard primary={primary} rollup={rollup} ranged={ranged} primaryDate={primaryDate} />
        <OpenIssuesCard primary={primary} ranged={ranged} />
      </div>

      {/* Outlook (only meaningful for today/yesterday) */}
      {!ranged && primary && <OutlookCard primary={primary} />}

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-[11px] text-text-tertiary">
          {primary
            ? `Snapshot taken ${new Date(primary.computed_at).toLocaleTimeString()}`
            : 'No snapshot yet for this range'}
        </p>
        <div className="flex items-center gap-2">
          <ExportCsvButton from={exportFrom} to={exportTo} />
          <RefreshButton date={primaryDate} />
        </div>
      </div>
    </div>
  )
}

/* ── Date tabs ───────────────────────────────────────────────────────────── */

function DateTabs({ current }: { current: TabKey }) {
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'today',     label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'week',      label: 'Last 7 days' },
    { key: 'month',     label: 'Last 30 days' },
  ]
  return (
    <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface-sunken p-1">
      {tabs.map(t => (
        <Link
          key={t.key}
          href={`/dashboard/owner?tab=${t.key}`}
          className={`flex-1 min-w-[100px] rounded-md py-1.5 text-center text-xs font-medium transition-colors ${
            current === t.key
              ? 'bg-surface shadow-sm text-text-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}

/* ── Hero card ───────────────────────────────────────────────────────────── */

function HeroCard({
  primary, comparison, rollup, prevRollup, ranged, sdlwDelta,
}: {
  primary:    DailyReport | null
  comparison: DailyReport | null
  rollup:     DailyRollup | null
  prevRollup: DailyRollup | null
  ranged:     boolean
  sdlwDelta:  number
}) {
  const current = ranged
    ? (rollup?.revenue_total ?? 0)
    : (primary?.revenue_total ?? 0)
  const previous = ranged
    ? (prevRollup?.revenue_total ?? 0)
    : (comparison?.revenue_total ?? 0)

  const d   = deltaVs(current, previous)
  const up  = d.pct >= 0
  const sdlwUp = sdlwDelta >= 0

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-surface to-surface-raised p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-text-tertiary">Revenue</p>
          <p className="mt-1 text-4xl font-bold text-text-primary tracking-tight">
            {formatGHS(current)}
          </p>
        </div>
        <TrendingUp className="h-6 w-6 text-text-tertiary" />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
          up ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'
        }`}>
          {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {up ? '+' : ''}{d.pct.toFixed(1)}%
          <span className="text-text-tertiary">vs {ranged ? 'prev period' : 'yesterday'}</span>
        </div>

        {!ranged && (
          <div className="text-xs text-text-tertiary">
            <span className={sdlwUp ? 'text-success' : 'text-danger'}>
              {sdlwUp ? '+' : ''}{formatGHS(sdlwDelta)}
            </span>
            {' '}vs same day last week
          </div>
        )}
      </div>

      {/* Stream breakdown */}
      <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-5">
        <StreamPill icon={<Bed className="h-3 w-3" />}    label="Rooms"    amount={ranged ? rollup?.revenue_rooms ?? 0   : primary?.revenue_rooms ?? 0} />
        <StreamPill icon={<Coffee className="h-3 w-3" />} label="Food"     amount={ranged ? rollup?.revenue_food ?? 0    : primary?.revenue_food ?? 0} />
        <StreamPill icon={<Dumbbell className="h-3 w-3" />} label="Walk-in" amount={ranged ? rollup?.revenue_walkin ?? 0 : primary?.revenue_walkin ?? 0} />
        <StreamPill icon={<ShoppingBag className="h-3 w-3" />} label="POS"    amount={ranged ? rollup?.revenue_pos ?? 0    : primary?.revenue_pos ?? 0} />
        <StreamPill icon={<Shirt className="h-3 w-3" />}  label="Deposits" amount={!ranged ? (primary?.revenue_deposits ?? 0) : 0} dim={ranged} />
      </div>
    </div>
  )
}

function StreamPill({ icon, label, amount, dim }: { icon: React.ReactNode; label: string; amount: number; dim?: boolean }) {
  return (
    <div className={`rounded-lg border border-border bg-surface px-3 py-2 ${dim ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-text-tertiary">
        {icon}{label}
      </div>
      <p className="mt-0.5 font-mono text-sm font-semibold text-text-primary">{formatGHS(amount)}</p>
    </div>
  )
}

/* ── KPI strip ───────────────────────────────────────────────────────────── */

function KpiStrip({
  primary, rollup, ranged,
}: {
  primary: DailyReport | null
  rollup:  DailyRollup | null
  ranged:  boolean
}) {
  if (!primary && !ranged) return null
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <KpiCard
        label="Occupancy"
        value={
          ranged
            ? `${(rollup?.occupancy_pct_avg ?? 0).toFixed(1)}%`
            : `${primary?.occupancy_pct ?? 0}%`
        }
        sub={
          ranged
            ? 'Avg over period'
            : `${primary?.rooms_occupied ?? 0}/${primary?.rooms_total ?? 0} rooms`
        }
        href="/rooms"
      />
      <KpiCard
        label="Movement"
        value={
          ranged
            ? `+${rollup?.arrivals ?? 0} / -${rollup?.departures ?? 0}`
            : `+${primary?.arrivals_today ?? 0} / -${primary?.departures_today ?? 0}`
        }
        sub={
          ranged
            ? 'in / out total'
            : `${primary?.no_shows_today ?? 0} no-show`
        }
        href="/bookings"
      />
      <KpiCard
        label="Cash variance"
        value={ranged ? formatGHS(rollup?.cash_variance ?? 0) : formatGHS(primary?.cash_variance ?? 0)}
        sub={
          ranged
            ? `${rollup?.days ?? 0} days`
            : variancePctLabel(primary?.cash_expected ?? 0, primary?.cash_variance ?? 0)
        }
        href="/shift-closeout/review"
        tone={hasCashAlert(primary, rollup, ranged) ? 'warn' : 'normal'}
      />
      <KpiCard
        label="Walk-ins"
        value={String(ranged ? rollup?.walkin_count ?? 0 : primary?.walkin_count ?? 0)}
        sub={
          ranged
            ? `${rollup?.food_orders_count ?? 0} food orders`
            : `${primary?.food_orders_count ?? 0} food orders`
        }
        href="/visitors"
      />
    </div>
  )
}

function variancePctLabel(expected: number, variance: number) {
  if (expected === 0) return variance === 0 ? 'balanced' : 'unmatched'
  const pct = (variance / expected) * 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

function hasCashAlert(primary: DailyReport | null, rollup: DailyRollup | null, ranged: boolean) {
  const variance = ranged ? rollup?.cash_variance ?? 0 : primary?.cash_variance ?? 0
  const expected = ranged ? 0 : primary?.cash_expected ?? 0
  if (variance === 0) return false
  if (expected === 0) return Math.abs(variance) > 5000      // GH₵ 50 absolute
  return Math.abs(variance / expected) > 0.02              // > 2% of expected
}

function KpiCard({ label, value, sub, href, tone = 'normal' }: {
  label: string; value: string; sub?: string; href?: string; tone?: 'normal' | 'warn'
}) {
  const inner = (
    <div className={`rounded-xl border bg-surface p-4 transition-colors ${
      tone === 'warn'
        ? 'border-warning/30 hover:bg-warning-subtle/40'
        : 'border-border hover:bg-surface-raised'
    }`}>
      <p className="text-[10px] uppercase tracking-wide text-text-tertiary">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone === 'warn' ? 'text-warning-fg' : 'text-text-primary'}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-text-tertiary">{sub}</p>}
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

/* ── Revenue by method ───────────────────────────────────────────────────── */

function RevenueByMethod({ primary, rollup, ranged }: {
  primary: DailyReport | null; rollup: DailyRollup | null; ranged: boolean
}) {
  const buckets: { label: string; value: number; color: string }[] = ranged
    ? [
        { label: 'Cash', value: rollup?.rev_cash ?? 0, color: 'bg-emerald-500' },
        { label: 'MoMo', value: rollup?.rev_momo ?? 0, color: 'bg-amber-500' },
        { label: 'Card', value: rollup?.rev_card ?? 0, color: 'bg-blue-500' },
        { label: 'Bank', value: rollup?.rev_bank ?? 0, color: 'bg-purple-500' },
      ]
    : [
        { label: 'Cash', value: primary?.rev_cash ?? 0, color: 'bg-emerald-500' },
        { label: 'MoMo', value: primary?.rev_momo ?? 0, color: 'bg-amber-500' },
        { label: 'Card', value: primary?.rev_card ?? 0, color: 'bg-blue-500' },
        { label: 'Bank', value: primary?.rev_bank ?? 0, color: 'bg-purple-500' },
        ...(primary?.rev_online_other
          ? [{ label: 'On account', value: primary.rev_online_other, color: 'bg-slate-400' }]
          : []),
      ]
  const total = buckets.reduce((s, b) => s + b.value, 0)

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">Revenue by method</h2>
        <Link href="/reports/revenue" className="flex items-center gap-0.5 text-xs text-brand hover:underline">
          See report <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {total === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-text-tertiary">
          No revenue recorded yet.
        </p>
      ) : (
        <>
          {/* Stacked bar */}
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
            {buckets.map(b => {
              const pct = (b.value / total) * 100
              if (pct < 0.1) return null
              return <div key={b.label} className={b.color} style={{ width: `${pct}%` }} />
            })}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {buckets.map(b => (
              <div key={b.label} className="flex items-center gap-2 text-xs">
                <span className={`h-2 w-2 rounded-full ${b.color}`} />
                <div>
                  <p className="font-medium text-text-primary">{b.label}</p>
                  <p className="font-mono text-text-tertiary">{formatGHS(b.value)}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ── Activity ────────────────────────────────────────────────────────────── */

function ActivityCard({ primary, rollup, ranged, primaryDate }: {
  primary: DailyReport | null
  rollup:  DailyRollup | null
  ranged:  boolean
  primaryDate: string
}) {
  const rows = ranged
    ? [
        { label: 'Check-ins',    value: rollup?.arrivals ?? 0,          href: `/bookings?status=checked_in` },
        { label: 'Check-outs',   value: rollup?.departures ?? 0,        href: `/bookings?status=checked_out` },
        { label: 'Food orders',  value: rollup?.food_orders_count ?? 0, href: `/food/orders` },
        { label: 'Walk-in QR sales', value: rollup?.walkin_count ?? 0,  href: `/visitors` },
      ]
    : [
        { label: 'Check-ins',    value: primary?.arrivals_today ?? 0,    href: `/bookings?status=checked_in&date=${primaryDate}` },
        { label: 'Check-outs',   value: primary?.departures_today ?? 0,  href: `/bookings?status=checked_out&date=${primaryDate}` },
        { label: 'No-shows',     value: primary?.no_shows_today ?? 0,    href: `/bookings?status=pending_payment&date=${primaryDate}` },
        { label: 'Food orders',  value: primary?.food_orders_count ?? 0, href: `/food/orders?date=${primaryDate}` },
        { label: 'Walk-in QR sales', value: primary?.walkin_count ?? 0,  href: `/visitors` },
      ]
  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
      <h2 className="text-sm font-semibold text-text-primary">Activity</h2>
      <div className="divide-y divide-border">
        {rows.map(r => (
          <Link key={r.label} href={r.href}
                className="flex items-center justify-between py-2.5 text-sm hover:bg-surface-raised -mx-1 px-1 rounded-md transition-colors">
            <span className="text-text-secondary">{r.label}</span>
            <span className="flex items-center gap-1 font-semibold text-text-primary">
              {r.value}
              <ChevronRight className="h-3 w-3 text-text-tertiary" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

/* ── Open issues ─────────────────────────────────────────────────────────── */

function OpenIssuesCard({ primary, ranged }: { primary: DailyReport | null; ranged: boolean }) {
  // Open-issue counts are point-in-time. For ranged tabs, show today's
  // current state so the owner sees what's outstanding right now.
  if (!primary) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-text-primary">Open issues</h2>
        <p className="mt-3 text-xs text-text-tertiary">No snapshot yet.</p>
      </div>
    )
  }

  const items: { label: string; value: number; icon: React.ReactNode; href: string; alert?: boolean }[] = [
    { label: 'Maintenance open',   value: primary.maintenance_open,    icon: <Wrench className="h-3.5 w-3.5" />, href: '/maintenance?status=open' },
    { label: 'Housekeeping pending', value: primary.housekeeping_pending, icon: <SprayCan className="h-3.5 w-3.5" />, href: '/housekeeping' },
    { label: 'Laundry in progress', value: primary.laundry_in_progress, icon: <Shirt className="h-3.5 w-3.5" />, href: '/revenue-points' },
    { label: 'Bank drafts pending', value: primary.bank_drafts_pending, icon: <FileWarning className="h-3.5 w-3.5" />, href: '/payments/drafts' },
    { label: 'Anomalies (critical)', value: primary.anomalies_critical, icon: <AlertTriangle className="h-3.5 w-3.5" />, href: '/intelligence/anomalies', alert: primary.anomalies_critical > 0 },
    { label: 'Overdue installments', value: primary.overdue_installments_count, icon: <FileWarning className="h-3.5 w-3.5" />, href: '/payments?overdue=true', alert: primary.overdue_installments_count > 0 },
  ]

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">Open issues</h2>
        {!ranged && <p className="text-[10px] text-text-tertiary">Live now</p>}
      </div>
      <div className="divide-y divide-border">
        {items.map(i => (
          <Link key={i.label} href={i.href}
                className={`flex items-center justify-between py-2.5 text-sm -mx-1 px-1 rounded-md transition-colors ${
                  i.alert ? 'hover:bg-warning-subtle/40' : 'hover:bg-surface-raised'
                }`}>
            <span className={`flex items-center gap-2 ${i.alert ? 'text-warning-fg' : 'text-text-secondary'}`}>
              {i.icon}
              {i.label}
            </span>
            <span className={`flex items-center gap-1 font-semibold ${i.alert ? 'text-warning-fg' : 'text-text-primary'}`}>
              {i.value}
              <ChevronRight className="h-3 w-3 text-text-tertiary" />
            </span>
          </Link>
        ))}
      </div>
      {primary.first_anomaly_msg && (
        <div className="rounded-lg border border-warning/30 bg-warning-subtle/40 px-3 py-2 text-xs text-warning-fg">
          <strong className="font-semibold">Latest critical: </strong>
          {primary.first_anomaly_msg}
        </div>
      )}
      {primary.outstanding_balance > 0 && (
        <div className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs text-text-secondary">
          Outstanding receivable balance:{' '}
          <span className="font-mono font-semibold text-text-primary">
            {formatGHS(primary.outstanding_balance)}
          </span>
        </div>
      )}
    </div>
  )
}

/* ── Outlook ─────────────────────────────────────────────────────────────── */

function OutlookCard({ primary }: { primary: DailyReport }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-2">
      <h2 className="text-sm font-semibold text-text-primary">Outlook</h2>
      <div className="grid grid-cols-3 gap-3">
        <Link href="/bookings?upcoming=7" className="rounded-lg border border-border bg-surface-raised p-3 hover:bg-surface-sunken transition-colors">
          <p className="text-[10px] uppercase tracking-wide text-text-tertiary">Arrivals · 7 d</p>
          <p className="mt-1 text-lg font-bold text-text-primary">{primary.arrivals_next_7d}</p>
        </Link>
        <Link href="/bookings/renewals" className="rounded-lg border border-border bg-surface-raised p-3 hover:bg-surface-sunken transition-colors">
          <p className="text-[10px] uppercase tracking-wide text-text-tertiary">Renewals · 30 d</p>
          <p className="mt-1 text-lg font-bold text-text-primary">{primary.renewals_due_30d}</p>
        </Link>
        <Link href="/bookings/renewals" className="rounded-lg border border-border bg-surface-raised p-3 hover:bg-surface-sunken transition-colors">
          <p className="text-[10px] uppercase tracking-wide text-text-tertiary">Lease expiry · 30 d</p>
          <p className="mt-1 text-lg font-bold text-text-primary">{primary.lease_expiry_30d}</p>
        </Link>
      </div>
    </div>
  )
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function isoMinus(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}
