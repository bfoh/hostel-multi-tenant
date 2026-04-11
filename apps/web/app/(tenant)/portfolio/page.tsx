import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, Users, BedDouble, TrendingUp, AlertTriangle, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = { title: 'Portfolio Overview' }

function formatGHS(pesewas: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', maximumFractionDigits: 0 }).format(pesewas / 100)
}

interface PropertySummary {
  id: string
  name: string
  slug: string
  address_city: string | null
  address_region: string | null
  status: string
  role: string
  totalRooms: number
  availableRooms: number
  occupancyRate: number
  activeBookings: number
  revenueThisMonth: number
  pendingPayments: number
  openAlerts: number
}

async function getPortfolioData(userId: string): Promise<PropertySummary[]> {
  const supabase = createAdminClient()

  // All tenants this user is a member of
  const { data: memberships } = await supabase
    .from('tenant_members')
    .select('tenant_id, role, tenants(id, name, slug, address_city, address_region, status)')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (!memberships || memberships.length === 0) return []

  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const results = await Promise.all(
    memberships.map(async (m) => {
      const tenant = m.tenants as any
      const tid    = tenant.id

      const [
        { data: rooms },
        { data: bookings },
        { data: payments },
        { count: alertCount },
      ] = await Promise.all([
        supabase.from('rooms').select('id, status').eq('tenant_id', tid),
        supabase.from('bookings').select('id, status, payment_status').eq('tenant_id', tid).in('status', ['confirmed', 'pending_payment']),
        supabase.from('payments').select('amount').eq('tenant_id', tid).gte('created_at', start).eq('status', 'completed'),
        supabase.from('anomaly_alerts').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).in('severity', ['critical', 'warning']).gte('created_at', start),
      ])

      const totalRooms     = (rooms ?? []).length
      const availableRooms = (rooms ?? []).filter(r => r.status === 'available').length
      const occupancyRate  = totalRooms > 0 ? Math.round(((totalRooms - availableRooms) / totalRooms) * 100) : 0
      const activeBookings = (bookings ?? []).length
      const pendingPayments = (bookings ?? []).filter(b => b.payment_status === 'unpaid').length
      const revenueThisMonth = (payments ?? []).reduce((sum, p) => sum + ((p.amount as number) ?? 0), 0)

      return {
        id:               tenant.id,
        name:             tenant.name,
        slug:             tenant.slug,
        address_city:     tenant.address_city,
        address_region:   tenant.address_region,
        status:           tenant.status,
        role:             m.role,
        totalRooms,
        availableRooms,
        occupancyRate,
        activeBookings,
        revenueThisMonth,
        pendingPayments,
        openAlerts:       alertCount ?? 0,
      } as PropertySummary
    })
  )

  return results
}

function OccupancyBar({ rate }: { rate: number }) {
  const color = rate >= 80 ? '#16a34a' : rate >= 50 ? '#d97706' : '#dc2626'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${rate}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-semibold tabular-nums" style={{ color }}>{rate}%</span>
    </div>
  )
}

export default async function PortfolioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const properties = await getPortfolioData(user.id)

  // Aggregate totals
  const totals = properties.reduce(
    (acc, p) => ({
      rooms:    acc.rooms    + p.totalRooms,
      bookings: acc.bookings + p.activeBookings,
      revenue:  acc.revenue  + p.revenueThisMonth,
      alerts:   acc.alerts   + p.openAlerts,
    }),
    { rooms: 0, bookings: 0, revenue: 0, alerts: 0 }
  )

  const avgOccupancy = properties.length > 0
    ? Math.round(properties.reduce((s, p) => s + p.occupancyRate, 0) / properties.length)
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Portfolio Overview</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Aggregated view across all {properties.length} propert{properties.length === 1 ? 'y' : 'ies'} you manage.
        </p>
      </div>

      {properties.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <Building2 className="mx-auto h-8 w-8 text-text-disabled mb-2" />
          <p className="text-sm font-medium text-text-primary">No properties found</p>
          <p className="text-xs text-text-secondary mt-1">You are not a member of any hostel accounts.</p>
        </div>
      ) : (
        <>
          {/* ── Aggregate summary row ───────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total rooms',      value: totals.rooms,                icon: BedDouble,    color: 'text-primary' },
              { label: 'Avg occupancy',    value: `${avgOccupancy}%`,          icon: TrendingUp,   color: avgOccupancy >= 70 ? 'text-success' : 'text-warning' },
              { label: 'Active bookings',  value: totals.bookings,             icon: Users,        color: 'text-info' },
              { label: 'Revenue this month', value: formatGHS(totals.revenue), icon: TrendingUp,   color: 'text-success' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-xl border border-border bg-surface p-4">
                <div className={`flex items-center gap-2 ${color}`}>
                  <Icon className="h-4 w-4" />
                  <p className="text-xs font-medium text-text-secondary">{label}</p>
                </div>
                <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* ── Per-property cards ──────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {properties.map(p => (
              <div
                key={p.id}
                className={`rounded-xl border bg-surface p-5 space-y-4 ${
                  p.status !== 'active' ? 'opacity-60' : ''
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-text-primary truncate">{p.name}</h2>
                      {p.status !== 'active' && (
                        <span className="shrink-0 rounded-full bg-warning/10 text-warning text-[10px] font-semibold px-2 py-0.5 capitalize">
                          {p.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      {[p.address_city, p.address_region].filter(Boolean).join(', ') || 'Location not set'}
                      {' · '}
                      <span className="capitalize">{p.role}</span>
                    </p>
                  </div>
                  <Link
                    href={`/dashboard`}
                    className="shrink-0 rounded-lg border border-border p-1.5 text-text-tertiary hover:text-text-primary hover:bg-surface-raised transition-colors"
                    title="Open dashboard"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {/* Occupancy bar */}
                <div>
                  <div className="flex justify-between text-xs text-text-secondary mb-1">
                    <span>Occupancy</span>
                    <span>{p.totalRooms - p.availableRooms}/{p.totalRooms} rooms</span>
                  </div>
                  <OccupancyBar rate={p.occupancyRate} />
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-surface-raised px-3 py-2">
                    <p className="text-[11px] text-text-tertiary">Active bookings</p>
                    <p className="text-sm font-bold text-text-primary mt-0.5">{p.activeBookings}</p>
                  </div>
                  <div className="rounded-lg bg-surface-raised px-3 py-2">
                    <p className="text-[11px] text-text-tertiary">Revenue (month)</p>
                    <p className="text-sm font-bold text-text-primary mt-0.5">{formatGHS(p.revenueThisMonth)}</p>
                  </div>
                  <div className="rounded-lg bg-surface-raised px-3 py-2">
                    <p className="text-[11px] text-text-tertiary">Unpaid bookings</p>
                    <p className={`text-sm font-bold mt-0.5 ${p.pendingPayments > 0 ? 'text-warning' : 'text-text-primary'}`}>{p.pendingPayments}</p>
                  </div>
                  <div className="rounded-lg bg-surface-raised px-3 py-2">
                    <p className="text-[11px] text-text-tertiary">Open alerts</p>
                    <p className={`text-sm font-bold mt-0.5 flex items-center gap-1 ${p.openAlerts > 0 ? 'text-danger' : 'text-text-primary'}`}>
                      {p.openAlerts > 0 && <AlertTriangle className="h-3.5 w-3.5" />}
                      {p.openAlerts}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
