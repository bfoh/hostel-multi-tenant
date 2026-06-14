import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { BootstrapPlansButton } from '@/components/admin/bootstrap-plans-button'

export const metadata: Metadata = { title: 'Platform Overview — Super Admin' }

async function getPlatformStats() {
  const admin = createAdminClient()

  const [
    { count: totalTenants },
    { count: activeTenants },
    { count: trialTenants },
    { count: suspendedTenants },
    { count: totalRooms },
    { count: totalBookings },
    { data: revenueRows },
  ] = await Promise.all([
    admin.from('tenants').select('*', { count: 'exact', head: true }),
    admin.from('tenants').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('tenants').select('*', { count: 'exact', head: true }).eq('status', 'trial'),
    admin.from('tenants').select('*', { count: 'exact', head: true }).eq('status', 'suspended'),
    admin.from('rooms').select('*', { count: 'exact', head: true }),
    admin.from('bookings').select('*', { count: 'exact', head: true }),
    admin.from('payments').select('amount'),
  ])

  const totalRevenue = revenueRows?.reduce((s, r) => s + ((r.amount as number) ?? 0), 0) ?? 0

  return {
    totalTenants: totalTenants ?? 0,
    activeTenants: activeTenants ?? 0,
    trialTenants: trialTenants ?? 0,
    suspendedTenants: suspendedTenants ?? 0,
    totalRooms: totalRooms ?? 0,
    totalBookings: totalBookings ?? 0,
    totalRevenue,
  }
}

async function getRecentTenants() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('tenants')
    .select('id, name, slug, status, plan, created_at')
    .order('created_at', { ascending: false })
    .limit(10)
  return data ?? []
}

const STATUS_COLOR: Record<string, string> = {
  active:    'bg-green-900/50 text-green-400',
  trial:     'bg-yellow-900/50 text-yellow-400',
  suspended: 'bg-red-900/50 text-red-400',
  cancelled: 'bg-gray-700 text-gray-400',
}

export default async function AdminOverviewPage() {
  const [stats, tenants] = await Promise.all([getPlatformStats(), getRecentTenants()])

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
        <p className="mt-1 text-sm text-white/50">Live stats across all tenants</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Tenants',    value: stats.totalTenants,    sub: `${stats.activeTenants} active` },
          { label: 'Trial Accounts',   value: stats.trialTenants,    sub: 'converting soon' },
          { label: 'Suspended',        value: stats.suspendedTenants, sub: 'need attention', danger: stats.suspendedTenants > 0 },
          { label: 'Total Rooms',      value: stats.totalRooms,       sub: 'across all hostels' },
          { label: 'Total Bookings',   value: stats.totalBookings,    sub: 'all time' },
          {
            label: 'Platform Revenue',
            value: `GHS ${stats.totalRevenue.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            sub: 'all-time payments',
          },
        ].map((k) => (
          <div
            key={k.label}
            className={`rounded-xl border p-4 ${k.danger ? 'border-red-800 bg-red-950/30' : 'border-white/10 bg-white/5'}`}
          >
            <p className="text-xs text-white/40 uppercase tracking-wide">{k.label}</p>
            <p className={`mt-1 text-2xl font-bold ${k.danger ? 'text-red-400' : 'text-white'}`}>{k.value}</p>
            <p className="mt-0.5 text-xs text-white/30">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Paystack plan bootstrap */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-2">
        <h2 className="text-sm font-semibold text-white">Paystack plans</h2>
        <p className="text-xs text-white/50">
          One-time: create the 8 platform subscription plans — Starter and Growth, each billed
          monthly, quarterly, 6-monthly, or yearly. Idempotent — skips plans whose env code is already set.
        </p>
        <BootstrapPlansButton />
      </div>

      {/* Recent tenants */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Recent Tenants</h2>
          <Link href="/admin/tenants" className="text-xs text-white/50 hover:text-white transition-colors">
            View all →
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-white/30 uppercase">
              <th className="text-left px-4 py-2 font-medium">Hostel</th>
              <th className="text-left px-4 py-2 font-medium">Slug</th>
              <th className="text-left px-4 py-2 font-medium">Plan</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-left px-4 py-2 font-medium">Joined</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {tenants.map((t) => (
              <tr key={t.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 font-medium text-white">{t.name}</td>
                <td className="px-4 py-3 text-white/50 font-mono text-xs">{t.slug}</td>
                <td className="px-4 py-3 text-white/50 capitalize">{t.plan}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[t.status] ?? 'text-white/50'}`}>
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/40 text-xs">
                  {new Date(t.created_at).toLocaleDateString('en-GH', { dateStyle: 'medium' })}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/tenants/${t.id}`}
                    className="text-xs text-white/40 hover:text-white transition-colors"
                  >
                    Manage →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
