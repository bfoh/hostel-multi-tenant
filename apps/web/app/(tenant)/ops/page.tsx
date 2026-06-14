import type { Metadata } from 'next'
import Link from 'next/link'
import {
  LogIn, LogOut, SprayCan, Wrench, Utensils, UserCheck,
  AlertTriangle, Clock, ArrowRight, Flame,
} from 'lucide-react'

import { getOpsOverview } from '@/lib/data/ops'
import { formatGHS } from '@/lib/utils'

export const metadata: Metadata = { title: 'Operations · Today' }

export default async function OpsDashboardPage() {
  const o = await getOpsOverview()

  if (!o) {
    return (
      <div className="rounded-xl border border-border bg-surface p-12 text-center">
        <p className="text-sm text-text-secondary">No tenant context.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Today's Operations</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Live front-desk view ·{' '}
          <strong className="text-text-primary">
            {new Date(o.asOf).toLocaleDateString('en-GH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </strong>
        </p>
      </div>

      {/* Top KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Kpi label="Arrivals due"    value={o.arrivals.yetToCheckIn}     icon={LogIn}    tone="brand"   sublabel={`${o.arrivals.checkedInToday} already in`} />
        <Kpi label="Departures due"  value={o.departures.yetToCheckOut}  icon={LogOut}   tone={o.departures.overdue > 0 ? 'danger' : 'brand'} sublabel={`${o.departures.overdue} overdue`} />
        <Kpi label="HK in progress"  value={o.housekeeping.in_progress}  icon={SprayCan} tone={o.housekeeping.urgent_open > 0 ? 'warning' : 'neutral'} sublabel={`${o.housekeeping.pending} pending · ${o.housekeeping.urgent_open} urgent`} />
        <Kpi label="Maintenance open"value={o.maintenance.open + o.maintenance.in_progress} icon={Wrench} tone={o.maintenance.overdue7d > 0 ? 'warning' : 'neutral'} sublabel={`${o.maintenance.overdue7d} > 7d old`} />
        <Kpi label="Food orders"     value={o.food.preparing + o.food.ready} icon={Utensils} tone="neutral" sublabel={`${o.food.placed_today} placed today · ${formatGHS(o.food.revenue_today)}`} />
        <Kpi label="Visitors inside" value={o.visitors.currently_inside}  icon={UserCheck} tone="neutral" sublabel={`${o.visitors.checked_in_today} signed in today`} />
      </div>

      {/* Arrivals + departures lists */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ListCard
          title="Arrivals due today"
          icon={LogIn}
          link={{ href: '/bookings', label: 'All bookings' }}
          rows={o.arrivals.today.map((a) => ({
            id:      a.booking_id,
            href:    `/bookings/${a.booking_id}`,
            primary: a.occupant_name,
            secondary: <>Room <strong className="text-text-primary">{a.room_label}</strong> · ref {a.booking_ref}</>,
            badge:   { tone: 'brand' as const, text: 'Awaiting' },
          }))}
          empty="No arrivals due."
        />
        <ListCard
          title="Departures due"
          icon={LogOut}
          link={{ href: '/bookings', label: 'All bookings' }}
          rows={o.departures.today.map((d) => ({
            id:      d.booking_id,
            href:    `/bookings/${d.booking_id}`,
            primary: d.occupant_name,
            secondary: <>Room <strong className="text-text-primary">{d.room_label}</strong> · ref {d.booking_ref}</>,
            badge:   d.daysOver > 0
              ? { tone: 'danger' as const, text: `${d.daysOver}d overdue` }
              : { tone: 'brand'  as const, text: 'Today' },
          }))}
          empty="No departures due."
        />
      </div>

      {/* Housekeeping + maintenance */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ListCard
          title="Housekeeping queue"
          icon={SprayCan}
          link={{ href: '/housekeeping', label: 'Open board' }}
          rows={o.housekeeping.list.map((t) => ({
            id:      t.id,
            href:    '/housekeeping',
            primary: <>Room <strong className="text-text-primary">{t.room_label}</strong></>,
            secondary: <span className="capitalize">{t.status.replace('_', ' ')}{t.due_by ? ` · due ${new Date(t.due_by).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })}` : ''}</span>,
            badge: t.priority === 'urgent'
              ? { tone: 'danger' as const, icon: Flame, text: 'Urgent' }
              : t.priority === 'high'
              ? { tone: 'warning' as const, text: 'High' }
              : { tone: 'neutral' as const, text: t.priority },
          }))}
          empty="Nothing pending."
        />

        <ListCard
          title="Maintenance queue"
          icon={Wrench}
          link={{ href: '/maintenance', label: 'Open tickets' }}
          rows={o.maintenance.list.map((m) => {
            const ageH = Math.floor((Date.now() - new Date(m.created_at).getTime()) / (60 * 60 * 1000))
            const ageLabel = ageH < 24 ? `${ageH}h` : `${Math.floor(ageH / 24)}d`
            return {
              id:      m.id,
              href:    `/maintenance/${m.id}`,
              primary: m.title,
              secondary: <>Room <strong className="text-text-primary">{m.room_label}</strong> · open {ageLabel}</>,
              badge: m.priority === 'urgent'
                ? { tone: 'danger' as const, icon: Flame, text: 'Urgent' }
                : m.priority === 'high'
                ? { tone: 'warning' as const, text: 'High' }
                : { tone: 'neutral' as const, text: m.priority },
            }
          })}
          empty="No open maintenance."
        />
      </div>

      {/* Food + visitors */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="border-b border-border bg-surface-raised px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Utensils className="h-4 w-4 text-brand" />
              <h2 className="text-sm font-semibold text-text-primary">Food orders today</h2>
            </div>
            <Link href="/food-orders" className="text-xs text-text-secondary hover:text-brand transition-colors">
              All orders →
            </Link>
          </div>
          <div className="grid grid-cols-4 divide-x divide-border/40">
            <FoodCell label="Placed"        value={o.food.placed_today}    tone="brand"   />
            <FoodCell label="Preparing"     value={o.food.preparing}       tone="warning" />
            <FoodCell label="Ready"         value={o.food.ready}           tone="success" />
            <FoodCell label="Picked up"     value={o.food.picked_up_today} tone="neutral" />
          </div>
          <div className="border-t border-border bg-surface-raised px-4 py-2.5 text-xs text-text-secondary flex items-center justify-between">
            <span>Today's revenue</span>
            <strong className="text-text-primary tabular-nums currency-amount">{formatGHS(o.food.revenue_today)}</strong>
          </div>
        </div>

        <ListCard
          title="Visitors currently inside"
          icon={UserCheck}
          link={{ href: '/security', label: 'Visitor log' }}
          rows={o.visitors.list.map((v) => ({
            id:      v.id,
            href:    '/security',
            primary: v.name,
            secondary: <>{v.host ? <>Guest of <strong className="text-text-primary">{v.host}</strong></> : 'No host recorded'} · in since {new Date(v.checked_in_at).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })}</>,
            badge: { tone: 'neutral' as const, text: 'Inside' },
          }))}
          empty="No active visitors."
        />
      </div>

      {(o.departures.overdue > 0 || o.maintenance.overdue7d > 0 || o.housekeeping.urgent_open > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Needs attention</p>
            <ul className="mt-1 list-disc pl-5 space-y-0.5">
              {o.departures.overdue   > 0 && <li>{o.departures.overdue} guest{o.departures.overdue === 1 ? '' : 's'} past their checkout date</li>}
              {o.housekeeping.urgent_open > 0 && <li>{o.housekeeping.urgent_open} urgent housekeeping task{o.housekeeping.urgent_open === 1 ? '' : 's'} open</li>}
              {o.maintenance.overdue7d > 0 && <li>{o.maintenance.overdue7d} maintenance ticket{o.maintenance.overdue7d === 1 ? '' : 's'} open more than 7 days</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Components ─────────────────────────────────────────────────────────── */

function Kpi({
  label, value, icon: Icon, tone, sublabel,
}: {
  label: string
  value: number
  icon: React.ElementType
  tone: 'brand' | 'danger' | 'warning' | 'neutral'
  sublabel?: string
}) {
  const color = {
    brand:   'text-brand',
    danger:  'text-danger',
    warning: 'text-warning',
    neutral: 'text-text-primary',
  }[tone]
  const bg = {
    brand:   'bg-brand/10',
    danger:  'bg-danger/10',
    warning: 'bg-warning/10',
    neutral: 'bg-surface-raised',
  }[tone]
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-secondary">{label}</p>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${bg}`}>
          <Icon className={`h-3.5 w-3.5 ${color}`} />
        </div>
      </div>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {sublabel && <p className="mt-1 text-[11px] text-text-tertiary truncate">{sublabel}</p>}
    </div>
  )
}

interface Row {
  id:         string
  href:       string
  primary:    React.ReactNode
  secondary:  React.ReactNode
  badge?:     { tone: 'brand' | 'danger' | 'warning' | 'neutral' | 'success'; text: string; icon?: React.ElementType }
}

function ListCard({
  title, icon: Icon, rows, empty, link,
}: {
  title: string
  icon:  React.ElementType
  rows:  Row[]
  empty: string
  link?: { href: string; label: string }
}) {
  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="border-b border-border bg-surface-raised px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-brand" />
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        </div>
        {link && (
          <Link href={link.href} className="inline-flex items-center gap-0.5 text-xs text-text-secondary hover:text-brand transition-colors">
            {link.label} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-sm text-center text-text-tertiary">{empty}</p>
      ) : (
        <ul className="divide-y divide-border/40">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={r.href} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-raised/50 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary truncate">{r.primary}</p>
                  <p className="mt-0.5 text-[11px] text-text-tertiary truncate">{r.secondary}</p>
                </div>
                {r.badge && <Badge {...r.badge} />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Badge({
  tone, text, icon: Icon,
}: {
  tone: 'brand' | 'danger' | 'warning' | 'neutral' | 'success'
  text: string
  icon?: React.ElementType
}) {
  const cls = {
    brand:   'bg-brand/10 text-brand',
    danger:  'bg-danger/10 text-danger',
    warning: 'bg-warning/10 text-warning',
    neutral: 'bg-surface-raised text-text-secondary',
    success: 'bg-success/10 text-success',
  }[tone]
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}>
      {Icon && <Icon className="h-2.5 w-2.5" />}
      {text}
    </span>
  )
}

function FoodCell({
  label, value, tone,
}: {
  label: string
  value: number
  tone:  'brand' | 'warning' | 'success' | 'neutral'
}) {
  const color = {
    brand:   'text-brand',
    warning: 'text-warning',
    success: 'text-success',
    neutral: 'text-text-primary',
  }[tone]
  return (
    <div className="px-4 py-3 text-center">
      <p className="text-[11px] text-text-tertiary">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}
