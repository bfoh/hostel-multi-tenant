import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Store, Dumbbell, UtensilsCrossed, ShoppingCart, WashingMachine,
  Printer, Car, Plus, ArrowUpRight, TrendingUp, Trophy, Search,
} from 'lucide-react'
import { getServerTenantId } from '@/lib/auth/tenant'
import { getRevenuePoints } from '@/lib/data/revenue-points'
import { formatGHS } from '@/lib/utils'
import { notFound } from 'next/navigation'
import { AddRevenuePointForm } from './add-point-form'

export const metadata: Metadata = { title: 'Revenue Points' }

const TYPE_ICON: Record<string, typeof Store> = {
  gym:        Dumbbell,
  sports:     Trophy,
  cafeteria:  UtensilsCrossed,
  restaurant: UtensilsCrossed,
  mini_mart:  ShoppingCart,
  laundry:    WashingMachine,
  printing:   Printer,
  parking:    Car,
  other:      Store,
}

const TYPE_COLOR: Record<string, string> = {
  gym:        'bg-purple-500/10 text-purple-600',
  sports:     'bg-amber-500/10 text-amber-600',
  cafeteria:  'bg-orange-500/10 text-orange-600',
  restaurant: 'bg-orange-500/10 text-orange-600',
  mini_mart:  'bg-blue-500/10 text-blue-600',
  laundry:    'bg-cyan-500/10 text-cyan-600',
  printing:   'bg-gray-500/10 text-gray-600',
  parking:    'bg-green-500/10 text-green-600',
  other:      'bg-brand/10 text-brand',
}

const TYPE_LABEL: Record<string, string> = {
  gym:        'Gym',
  sports:     'Sports Centre',
  cafeteria:  'Cafeteria',
  restaurant: 'Restaurant',
  mini_mart:  'Mini-Mart',
  laundry:    'Laundry',
  printing:   'Printing',
  parking:    'Parking',
  other:      'Other',
}

export default async function RevenuePointsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) notFound()

  const { q = '' } = await searchParams
  const points = await getRevenuePoints(tenantId)
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const visiblePoints = points.filter((point) => {
    const haystack = [point.name, point.type, point.description].filter(Boolean).join(' ').toLowerCase()
    return terms.every(term => haystack.includes(term))
  })

  const todayTotal = points.reduce((s, p) => s + p.todaySales, 0)
  const monthTotal = points.reduce((s, p) => s + p.monthSales, 0)
  const todayCount = points.reduce((s, p) => s + p.todayCount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Revenue Points</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            Manage auxiliary revenue streams — gym, cafeteria, mini-mart, laundry, and more
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-tertiary">Active Points</p>
          <p className="mt-2 text-xl font-bold text-text-primary">{points.filter(p => p.is_active).length}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-tertiary">Today&apos;s Sales</p>
          <p className="mt-2 font-mono text-xl font-bold text-text-primary">{formatGHS(todayTotal)}</p>
          <p className="text-xs text-text-secondary">{todayCount} transaction{todayCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-tertiary">Month-to-Date</p>
          <p className="mt-2 font-mono text-xl font-bold text-success">{formatGHS(monthTotal)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand" />
            <p className="text-xs text-text-tertiary">Top Point</p>
          </div>
          {points.length > 0 ? (
            <>
              <p className="mt-2 text-sm font-semibold text-text-primary">
                {[...points].sort((a, b) => b.monthSales - a.monthSales)[0]?.name ?? '—'}
              </p>
              <p className="text-xs text-text-secondary font-mono">
                {formatGHS([...points].sort((a, b) => b.monthSales - a.monthSales)[0]?.monthSales ?? 0)}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-text-tertiary">—</p>
          )}
        </div>
      </div>

      <form action="/revenue-points" className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search revenue points</span>
          <Search className="text-text-tertiary pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search revenue point, type, or description"
            className="border-border bg-surface text-text-primary placeholder:text-text-disabled focus:border-brand w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm outline-none"
          />
        </label>
        <button type="submit" className="bg-brand text-brand-fg hover:bg-brand-hover rounded-lg px-5 py-2.5 text-sm font-semibold">Search</button>
        {q && <Link href="/revenue-points" className="text-text-secondary hover:text-text-primary self-center px-2 text-sm">Clear</Link>}
      </form>

      {/* Revenue point cards grid */}
      {visiblePoints.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visiblePoints.map((point) => {
            const Icon = TYPE_ICON[point.type] ?? Store
            const color = TYPE_COLOR[point.type] ?? TYPE_COLOR.other
            return (
              <Link
                key={point.id}
                href={`/revenue-points/${point.id}`}
                className="group rounded-xl border border-border bg-surface p-5 transition-all hover:border-brand/30 hover:shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-text-primary group-hover:text-brand transition-colors">
                        {point.name}
                      </h3>
                      <p className="text-xs text-text-tertiary">{TYPE_LABEL[point.type] ?? point.type}</p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-text-disabled group-hover:text-brand transition-colors" />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] text-text-tertiary">Today</p>
                    <p className="font-mono text-sm font-semibold text-text-primary">
                      {formatGHS(point.todaySales)}
                    </p>
                    <p className="text-[10px] text-text-disabled">
                      {point.todayCount} sale{point.todayCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-text-tertiary">This Month</p>
                    <p className="font-mono text-sm font-semibold text-success">
                      {formatGHS(point.monthSales)}
                    </p>
                  </div>
                </div>

                {!point.is_active && (
                  <div className="mt-3">
                    <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger">
                      Inactive
                    </span>
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <Store className="h-8 w-8 text-text-disabled" />
          <p className="font-medium text-text-primary">{terms.length > 0 ? 'No revenue points match your search' : 'No revenue points yet'}</p>
          <p className="text-sm text-text-secondary">
            {terms.length > 0 ? 'Try another name, type, or description.' : 'Add your first revenue point below — gym, cafeteria, mini-mart, laundry, etc.'}
          </p>
        </div>
      )}

      {/* Add new revenue point */}
      <AddRevenuePointForm />
    </div>
  )
}
