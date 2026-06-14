import type { Metadata } from 'next'
import Link from 'next/link'
import {
  BedDouble, TrendingUp, AlertTriangle, Activity,
  CreditCard, RefreshCw, CheckCircle2, Clock,
  XCircle, ArrowUpRight, ShieldAlert, Wifi,
  CalendarDays, Eye,
} from 'lucide-react'
import { formatGHS, formatDate } from '@/lib/utils'
import {
  getIntelligenceKpis,
  getActivityFeed,
  getAnomalyAlerts,
  getCashFlowForecast,
} from '@/lib/data/intelligence'

export const metadata: Metadata = { title: 'Intelligence' }

/* ── Action → icon + colour mapping ─────────────────────────────── */

function feedIcon(action: string) {
  if (action.startsWith('booking.created'))
    return { Icon: BedDouble,    color: 'text-info',    bg: 'bg-info-subtle' }
  if (action.startsWith('booking.status'))
    return { Icon: RefreshCw,    color: 'text-warning-fg', bg: 'bg-warning-subtle' }
  if (action.startsWith('payment.recorded'))
    return { Icon: CreditCard,   color: 'text-success',  bg: 'bg-success-subtle' }
  if (action.startsWith('payment.status'))
    return { Icon: RefreshCw,    color: 'text-warning-fg', bg: 'bg-warning-subtle' }
  return   { Icon: Activity,     color: 'text-text-secondary', bg: 'bg-surface-raised' }
}

function severityConfig(s: 'critical' | 'warning' | 'info') {
  return {
    critical: {
      bar: 'bg-danger',
      bg:  'bg-danger-subtle',
      border: 'border-danger/20',
      text: 'text-danger',
      badge: 'bg-danger text-white',
      Icon: ShieldAlert,
    },
    warning: {
      bar: 'bg-warning',
      bg:  'bg-warning-subtle',
      border: 'border-warning/20',
      text: 'text-warning-fg',
      badge: 'bg-warning-subtle text-warning-fg border border-warning/30',
      Icon: AlertTriangle,
    },
    info: {
      bar: 'bg-info',
      bg:  'bg-info-subtle',
      border: 'border-info/20',
      text: 'text-info',
      badge: 'bg-info-subtle text-info border border-info/20',
      Icon: Eye,
    },
  }[s]
}

function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)  return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return formatDate(iso)
}

export default async function IntelligencePage() {
  const [kpis, feed, alerts, forecast] = await Promise.all([
    getIntelligenceKpis(),
    getActivityFeed(40),
    getAnomalyAlerts(),
    getCashFlowForecast(),
  ])

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length
  const warningCount  = alerts.filter((a) => a.severity === 'warning').length

  const forecastTotal    = forecast.reduce((s, b) => s + b.final_amount, 0)
  const forecastCollected= forecast.reduce((s, b) => s + Math.min(b.paid_amount, b.final_amount), 0)
  const forecastBalance  = forecast.reduce((s, b) => s + b.balance, 0)

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Intelligence</h1>
          <p className="mt-0.5 text-sm text-text-secondary">Owner's control room — live property pulse</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-success/30 bg-success-subtle px-3 py-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <span className="text-xs font-medium text-success">Live</span>
          <Wifi className="h-3 w-3 text-success" />
        </div>
      </div>

      {/* ── KPI strip ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-text-tertiary">Occupancy</p>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10">
              <BedDouble className="h-3.5 w-3.5 text-brand" />
            </div>
          </div>
          <p className="text-2xl font-bold text-text-primary">{kpis.occupancyPct}%</p>
          <p className="mt-1 text-xs text-text-secondary">
            {kpis.occupied} occupied · {kpis.available} available
          </p>
          {/* Mini occupancy bar */}
          <div className="mt-3 h-1.5 w-full rounded-full bg-surface-sunken">
            <div
              className="h-1.5 rounded-full bg-brand"
              style={{ width: `${kpis.occupancyPct}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-success/20 bg-success-subtle p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-success">Today's Revenue</p>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/10">
              <TrendingUp className="h-3.5 w-3.5 text-success" />
            </div>
          </div>
          <p className="font-mono text-2xl font-bold text-success">{formatGHS(kpis.todayRevenue)}</p>
          <p className="mt-1 text-xs text-success/70">Payments received today</p>
        </div>

        <div className={`rounded-xl border p-4 ${
          criticalCount > 0
            ? 'border-danger/20 bg-danger-subtle'
            : warningCount > 0
              ? 'border-warning/20 bg-warning-subtle'
              : 'border-success/20 bg-success-subtle'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-xs ${criticalCount > 0 ? 'text-danger' : warningCount > 0 ? 'text-warning-fg' : 'text-success'}`}>
              Alerts
            </p>
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${
              criticalCount > 0 ? 'bg-danger/10' : warningCount > 0 ? 'bg-warning/10' : 'bg-success/10'
            }`}>
              <AlertTriangle className={`h-3.5 w-3.5 ${
                criticalCount > 0 ? 'text-danger' : warningCount > 0 ? 'text-warning-fg' : 'text-success'
              }`} />
            </div>
          </div>
          <p className={`text-2xl font-bold ${
            criticalCount > 0 ? 'text-danger' : warningCount > 0 ? 'text-warning-fg' : 'text-success'
          }`}>
            {alerts.length === 0 ? '✓' : alerts.length}
          </p>
          <p className={`mt-1 text-xs ${
            criticalCount > 0 ? 'text-danger/70'
            : warningCount > 0 ? 'text-warning-fg/70'
            : 'text-success/70'
          }`}>
            {alerts.length === 0
              ? 'All clear'
              : `${criticalCount} critical · ${warningCount} warning`}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-text-tertiary">Expected (30d)</p>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-info/10">
              <CalendarDays className="h-3.5 w-3.5 text-info" />
            </div>
          </div>
          <p className="font-mono text-2xl font-bold text-text-primary">{formatGHS(forecastBalance)}</p>
          <p className="mt-1 text-xs text-text-secondary">
            {forecast.length} upcoming check-in{forecast.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* ── Main grid: Feed + Alerts ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Activity feed — 2/3 */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-text-tertiary" />
                <h2 className="font-semibold text-text-primary">Activity Feed</h2>
              </div>
              <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-text-tertiary">
                Last {feed.length} events
              </span>
            </div>

            {feed.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Activity className="h-8 w-8 text-text-disabled" />
                <p className="font-medium text-text-primary">No activity yet</p>
                <p className="text-sm text-text-secondary">
                  Events appear here as bookings, payments, and changes are made.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-[560px] overflow-y-auto">
                {feed.map((entry) => {
                  const { Icon, color, bg } = feedIcon(entry.action)
                  return (
                    <div key={entry.id} className="flex items-start gap-3 px-5 py-3 hover:bg-surface-raised transition-colors">
                      {/* Icon */}
                      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${bg}`}>
                        <Icon className={`h-3.5 w-3.5 ${color}`} />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text-primary leading-snug">
                          {entry.description}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          {entry.actor_name && (
                            <span className="text-xs text-text-tertiary">{entry.actor_name}</span>
                          )}
                          {entry.actor_role && (
                            <span className="rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] font-medium text-text-secondary capitalize">
                              {entry.actor_role}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Time */}
                      <time className="shrink-0 text-[11px] text-text-tertiary whitespace-nowrap">
                        {relativeTime(entry.occurred_at)}
                      </time>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Anomaly alerts — 1/3 */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-text-tertiary" />
                <h2 className="font-semibold text-text-primary">Anomaly Alerts</h2>
              </div>
              {alerts.length > 0 && (
                <span className="rounded-full bg-danger px-2 py-0.5 text-[11px] font-bold text-white">
                  {alerts.length}
                </span>
              )}
            </div>

            {alerts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center px-4">
                <CheckCircle2 className="h-8 w-8 text-success" />
                <p className="font-medium text-text-primary">All clear</p>
                <p className="text-xs text-text-secondary">No anomalies detected at this time.</p>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
                {alerts.map((a) => {
                  const cfg = severityConfig(a.severity)
                  return (
                    <div key={a.id} className={`flex gap-3 px-4 py-3 ${cfg.bg}`}>
                      {/* Severity bar */}
                      <div className={`mt-1 w-0.5 shrink-0 rounded-full self-stretch ${cfg.bar}`} />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cfg.badge}`}>
                            {a.type}
                          </span>
                          {a.link && (
                            <Link
                              href={a.link}
                              className={`flex items-center gap-0.5 text-[11px] font-medium ${cfg.text} hover:underline`}
                            >
                              Fix <ArrowUpRight className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                        <p className={`text-xs font-medium ${cfg.text}`}>{a.title}</p>
                        <p className="mt-0.5 text-[11px] text-text-secondary leading-snug">{a.detail}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-3">Quick Actions</p>
            <div className="space-y-1.5">
              {[
                { href: '/bookings/new',  label: 'New booking',     Icon: BedDouble    },
                { href: '/payments',      label: 'View payments',   Icon: CreditCard   },
                { href: '/housekeeping',  label: 'Housekeeping',    Icon: CheckCircle2 },
                { href: '/reports',       label: 'Full reports',    Icon: TrendingUp   },
              ].map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-primary hover:bg-surface-raised transition-colors"
                >
                  <Icon className="h-3.5 w-3.5 text-text-tertiary" />
                  {label}
                  <ArrowUpRight className="ml-auto h-3 w-3 text-text-disabled" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 30-day cash flow forecast ────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-text-tertiary" />
              <h2 className="font-semibold text-text-primary">30-Day Cash Flow Forecast</h2>
            </div>
            <p className="mt-0.5 text-xs text-text-tertiary">Upcoming check-ins and expected payments</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-text-tertiary">Expected to collect</p>
            <p className="font-mono text-base font-bold text-text-primary">{formatGHS(forecastBalance)}</p>
          </div>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-surface-sunken">
          {[
            { label: 'Total billed',  value: forecastTotal,     color: 'text-text-primary' },
            { label: 'Already paid',  value: forecastCollected, color: 'text-success'      },
            { label: 'Still owed',    value: forecastBalance,   color: forecastBalance > 0 ? 'text-warning-fg' : 'text-success' },
          ].map((s) => (
            <div key={s.label} className="px-5 py-3 text-center">
              <p className="text-[11px] text-text-tertiary">{s.label}</p>
              <p className={`font-mono text-sm font-semibold ${s.color}`}>{formatGHS(s.value)}</p>
            </div>
          ))}
        </div>

        {forecast.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <CalendarDays className="h-8 w-8 text-text-disabled" />
            <p className="font-medium text-text-primary">No upcoming check-ins</p>
            <p className="text-sm text-text-secondary">Confirmed bookings for the next 30 days will appear here.</p>
            <Link
              href="/bookings/new"
              className="mt-2 rounded-md bg-brand px-4 py-1.5 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
            >
              Create booking
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-sunken">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Check-in</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Occupant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary hidden md:table-cell">Room</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary hidden lg:table-cell">Ref</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">Billed</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">Balance</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-text-tertiary">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {forecast.map((b) => {
                  const daysUntil = Math.ceil(
                    (new Date(b.check_in_date).getTime() - Date.now()) / 86_400_000
                  )
                  return (
                    <tr key={b.id} className="hover:bg-surface-raised transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-xs font-semibold text-text-primary">{b.check_in_date}</p>
                        <p className="text-[11px] text-text-tertiary">
                          {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil}d`}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-text-primary">
                          {b.occupant?.first_name} {b.occupant?.last_name}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-text-secondary hidden md:table-cell">
                        Room {b.room?.room_number}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="font-mono text-xs text-text-tertiary">{b.booking_ref}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-text-secondary">
                        {formatGHS(b.final_amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">
                        <span className={b.balance > 0 ? 'text-warning-fg' : 'text-success'}>
                          {formatGHS(b.balance)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          b.payment_status === 'paid'    ? 'bg-success-subtle text-success border border-success/20' :
                          b.payment_status === 'partial' ? 'bg-warning-subtle text-warning-fg border border-warning/20' :
                          'bg-danger-subtle text-danger border border-danger/20'
                        }`}>
                          {b.payment_status === 'paid'    ? <CheckCircle2 className="h-2.5 w-2.5" /> :
                           b.payment_status === 'partial' ? <Clock className="h-2.5 w-2.5" /> :
                           <XCircle className="h-2.5 w-2.5" />}
                          {b.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/bookings/${b.id}`}
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
        )}
      </div>

    </div>
  )
}
