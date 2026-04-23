import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

import { createAdminClient } from '@/lib/supabase/admin'
import { OccupancyCard } from '@/components/dashboard/occupancy-card'
import { RevenueCard } from '@/components/dashboard/revenue-card'
import { BookingsCard } from '@/components/dashboard/bookings-card'
import { AlertsCard } from '@/components/dashboard/alerts-card'
import { OccupancyChart } from '@/components/dashboard/occupancy-chart'
import { RecentBookings } from '@/components/dashboard/recent-bookings'
import { StatCardSkeleton } from '@/components/dashboard/stat-card-skeleton'
import { SetupChecklist } from '@/components/dashboard/setup-checklist'
import { AuxRevenueCard } from '@/components/dashboard/aux-revenue-card'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default async function DashboardPage() {
  const headersList = await headers()
  const tenantName = headersList.get('x-tenant-name') ?? 'Your Hostel'
  const tenantId   = headersList.get('x-tenant-id')

  // Redirect new owners to onboarding if they haven't completed it yet
  if (tenantId) {
    const admin = createAdminClient()
    const { data: tenant } = await admin
      .from('tenants')
      .select('onboarding_completed')
      .eq('id', tenantId)
      .single()
    if (tenant && !(tenant as any).onboarding_completed) {
      redirect('/onboarding')
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Page header ──────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{tenantName}</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Here&apos;s what&apos;s happening today
        </p>
      </div>

      {/* ── Onboarding checklist (hidden once all steps complete) ── */}
      <Suspense fallback={null}>
        <SetupChecklist />
      </Suspense>

      {/* ── KPI stat cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Suspense fallback={<StatCardSkeleton />}>
          <OccupancyCard />
        </Suspense>
        <Suspense fallback={<StatCardSkeleton />}>
          <RevenueCard />
        </Suspense>
        <Suspense fallback={<StatCardSkeleton />}>
          <AuxRevenueCard />
        </Suspense>
        <Suspense fallback={<StatCardSkeleton />}>
          <BookingsCard />
        </Suspense>
        <Suspense fallback={<StatCardSkeleton />}>
          <AlertsCard />
        </Suspense>
      </div>

      {/* ── Charts + recent activity ─────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Suspense
            fallback={
              <div className="skeleton h-64 w-full rounded-xl" />
            }
          >
            <OccupancyChart />
          </Suspense>
        </div>
        <div>
          <Suspense
            fallback={
              <div className="skeleton h-64 w-full rounded-xl" />
            }
          >
            <RecentBookings />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
