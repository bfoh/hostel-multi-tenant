import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Store, Dumbbell, UtensilsCrossed, ShoppingCart, WashingMachine,
  Printer, Car, Plus, ArrowUpRight, TrendingUp,
} from 'lucide-react'
import { getServerTenantId } from '@/lib/auth/tenant'
import { getRevenuePoints } from '@/lib/data/revenue-points'
import { formatGHS } from '@/lib/utils'
import { notFound } from 'next/navigation'
import { AddRevenuePointForm } from './add-point-form'

export const metadata: Metadata = { title: 'Revenue Points' }

const TYPE_ICON: Record<string, typeof Store> = {
  gym:        Dumbbell,
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
  cafeteria:  'Cafeteria',
  restaurant: 'Restaurant',
  mini_mart:  'Mini-Mart',
  laundry:    'Laundry',
  printing:   'Printing',
  parking:    'Parking',
  other:      'Other',
}

export default async function RevenuePointsPage() {
  const tenantId = await getServerTenantId()
  if (!tenantId) notFound()

  const points = await getRevenuePoints(tenantId)

  const todayTotal = points.reduce((s, p) => s + p.todaySales, 0)
  const monthTotal = points.reduce((s, p) => s + p.monthSales, 0)
  const todayCount = points.reduce((s, p) => s + p.todayCount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
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

      {/* Revenue point cards grid */}
      {points.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {points.map((point) => {
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
          <p className="font-medium text-text-primary">No revenue points yet</p>
          <p className="text-sm text-text-secondary">
            Add your first revenue point below — gym, cafeteria, mini-mart, laundry, etc.
          </p>
        </div>
      )}

      {/* Add new revenue point */}
      <AddRevenuePointForm />
    </div>
  )
}
