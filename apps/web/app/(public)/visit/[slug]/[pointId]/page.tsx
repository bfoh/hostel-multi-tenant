import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { readPublicConfig, type RevenuePointType } from '@/lib/walkin-pricing'
import { GymFlow } from '@/components/public/visit/gym-flow'
import { LaundryFlow } from '@/components/public/visit/laundry-flow'
import { SportsFlow } from '@/components/public/visit/sports-flow'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Pay' }

interface PageProps {
  params: Promise<{ slug: string; pointId: string }>
}

export default async function VisitPage({ params }: PageProps) {
  const { slug, pointId } = await params
  const supabase = createAdminClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, slug, logo_url, primary_color, contact_phone')
    .eq('slug', slug)
    .single()

  if (!tenant) notFound()

  const { data: pointRaw } = await supabase
    .from('revenue_points')
    .select('id, name, type, is_active, public_enabled, public_config')
    .eq('id', pointId)
    .eq('tenant_id', tenant.id)
    .single()
  const point = pointRaw as any

  if (!point || !point.is_active || !point.public_enabled) notFound()

  const type = point.type as RevenuePointType

  // Restaurant flows reuse the existing food-ordering portal.
  if (type === 'restaurant' || type === 'cafeteria') {
    redirect(`/order/${slug}`)
  }

  const config = readPublicConfig(type, point.public_config)
  if (!config) {
    return (
      <Shell tenant={tenant} pointName={point.name}>
        <p className="text-sm text-gray-600">
          This service has not been configured for online payment yet.
          Please pay at the counter.
        </p>
      </Shell>
    )
  }

  const brand = tenant.primary_color ?? '#2563EB'

  if (config.kind === 'gym') {
    return (
      <Shell tenant={tenant} pointName={point.name}>
        <GymFlow
          slug={slug}
          pointId={pointId}
          pointName={point.name}
          dayPassPrice={config.day_pass_price}
          includes={config.includes ?? []}
          brandColor={brand}
        />
      </Shell>
    )
  }

  if (config.kind === 'laundry') {
    return (
      <Shell tenant={tenant} pointName={point.name}>
        <LaundryFlow
          slug={slug}
          pointId={pointId}
          pointName={point.name}
          ratePerKg={config.rate_per_kg}
          minCharge={config.min_charge}
          turnaroundHours={config.turnaround_hours}
          brandColor={brand}
        />
      </Shell>
    )
  }

  if (config.kind === 'sports') {
    if (!config.courts || config.courts.length === 0) {
      return (
        <Shell tenant={tenant} pointName={point.name}>
          <p className="text-sm text-gray-600">
            No courts have been configured yet. Please pay at the counter.
          </p>
        </Shell>
      )
    }
    return (
      <Shell tenant={tenant} pointName={point.name}>
        <SportsFlow
          slug={slug}
          pointId={pointId}
          pointName={point.name}
          courts={config.courts}
          minMinutes={config.min_minutes}
          brandColor={brand}
        />
      </Shell>
    )
  }

  return (
    <Shell tenant={tenant} pointName={point.name}>
      <p className="text-sm text-gray-600">
        Walk-in payment for <strong>{point.name}</strong> is coming soon.
      </p>
    </Shell>
  )
}

function Shell({
  tenant,
  pointName,
  children,
}: {
  tenant: { name: string; logo_url: string | null; primary_color: string | null }
  pointName: string
  children: React.ReactNode
}) {
  const brand = tenant.primary_color ?? '#2563EB'
  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'Inter, sans-serif' }}>
      <header style={{ background: `linear-gradient(135deg, ${brand} 0%, ${brand}CC 100%)` }}>
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-6 text-white">
          {tenant.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover bg-white/20 p-1" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-lg font-bold">
              {tenant.name[0]}
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-wide text-white/70">{tenant.name}</p>
            <h1 className="text-lg font-bold leading-tight">{pointName}</h1>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          {children}
        </div>
      </main>
    </div>
  )
}
