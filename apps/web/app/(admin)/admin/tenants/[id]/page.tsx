import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { TenantAdminActions } from '@/components/admin/tenant-admin-actions'

export const metadata: Metadata = { title: 'Tenant — Super Admin' }

async function getTenant(id: string) {
  const admin = createAdminClient()

  const [
    { data: tenant },
    { count: roomCount },
    { count: occupantCount },
    { count: bookingCount },
    { data: revenueRows },
    { data: members },
  ] = await Promise.all([
    admin.from('tenants').select('*').eq('id', id).single(),
    admin.from('rooms').select('*', { count: 'exact', head: true }).eq('tenant_id', id),
    admin.from('occupants').select('*', { count: 'exact', head: true }).eq('tenant_id', id),
    admin.from('bookings').select('*', { count: 'exact', head: true }).eq('tenant_id', id),
    admin.from('payments').select('amount').eq('tenant_id', id),
    admin.from('tenant_members').select('user_id, role, is_active, joined_at').eq('tenant_id', id),
  ])

  if (!tenant) return null

  const totalRevenue = revenueRows?.reduce((s, r) => s + ((r.amount as number) ?? 0), 0) ?? 0

  return {
    tenant,
    stats: {
      rooms: roomCount ?? 0,
      occupants: occupantCount ?? 0,
      bookings: bookingCount ?? 0,
      revenue: totalRevenue,
    },
    members: members ?? [],
  }
}

const STATUS_COLOR: Record<string, string> = {
  active:    'bg-green-900/50 text-green-400',
  trial:     'bg-yellow-900/50 text-yellow-400',
  suspended: 'bg-red-900/50 text-red-400',
  cancelled: 'bg-gray-700 text-gray-400',
}

export default async function TenantAdminPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getTenant(id)
  if (!data) notFound()

  const { tenant, stats, members } = data

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{tenant.name}</h1>
          <p className="mt-1 text-sm text-white/40 font-mono">{tenant.slug}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_COLOR[tenant.status] ?? 'text-white/50'}`}>
            {tenant.status}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Rooms',     value: stats.rooms },
          { label: 'Occupants', value: stats.occupants },
          { label: 'Bookings',  value: stats.bookings },
          {
            label: 'Revenue',
            value: `GHS ${stats.revenue.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/30 uppercase">{s.label}</p>
            <p className="mt-1 text-xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tenant details */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide">Details</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {[
            ['Plan',          tenant.plan],
            ['Country',       tenant.country],
            ['Currency',      tenant.currency],
            ['Timezone',      tenant.timezone],
            ['Billing email', tenant.billing_email ?? '—'],
            ['Created',       new Date(tenant.created_at).toLocaleDateString('en-GH', { dateStyle: 'long' })],
            ['Trial ends',    tenant.trial_ends_at ? new Date(tenant.trial_ends_at).toLocaleDateString('en-GH', { dateStyle: 'long' }) : '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="text-white/30 w-28 shrink-0">{k}</dt>
              <dd className="text-white capitalize">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Members */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Members ({members.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-white/30 uppercase">
              <th className="text-left px-4 py-2 font-medium">User ID</th>
              <th className="text-left px-4 py-2 font-medium">Role</th>
              <th className="text-left px-4 py-2 font-medium">Active</th>
              <th className="text-left px-4 py-2 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {members.map((m) => (
              <tr key={m.user_id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-2.5 font-mono text-xs text-white/40">{m.user_id}</td>
                <td className="px-4 py-2.5 capitalize text-white/60">{m.role}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs ${m.is_active ? 'text-green-400' : 'text-white/30'}`}>
                    {m.is_active ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-white/40 text-xs">
                  {m.joined_at ? new Date(m.joined_at).toLocaleDateString('en-GH', { dateStyle: 'medium' }) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions (client component) */}
      <TenantAdminActions
        tenantId={tenant.id}
        tenantSlug={tenant.slug}
        currentStatus={tenant.status}
      />
    </div>
  )
}
