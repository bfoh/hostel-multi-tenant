import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = { title: 'Tenants — Super Admin' }

async function getTenants(search: string, status: string) {
  const admin = createAdminClient()

  let query = admin
    .from('tenants')
    .select('id, name, slug, status, plan, created_at, trial_ends_at, billing_email')
    .order('created_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status as any)
  }
  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  const { data } = await query.limit(100)
  return data ?? []
}

const STATUS_COLOR: Record<string, string> = {
  active:    'bg-green-900/50 text-green-400',
  trial:     'bg-yellow-900/50 text-yellow-400',
  suspended: 'bg-red-900/50 text-red-400',
  cancelled: 'bg-gray-700 text-gray-400',
}

const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter',
  growth: 'Growth',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

export default async function AdminTenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const { q = '', status = 'all' } = await searchParams
  const tenants = await getTenants(q, status)

  const STATUS_FILTERS = [
    { value: 'all',       label: 'All' },
    { value: 'trial',     label: 'Trial' },
    { value: 'active',    label: 'Active' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'cancelled', label: 'Cancelled' },
  ]

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Tenants</h1>
        <p className="mt-1 text-sm text-white/50">{tenants.length} results</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <form method="GET" className="flex-1 min-w-[200px] max-w-sm">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name…"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
          {status !== 'all' && <input type="hidden" name="status" value={status} />}
        </form>

        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <Link
              key={f.value}
              href={`/admin/tenants?status=${f.value}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                status === f.value || (f.value === 'all' && !status)
                  ? 'bg-white text-black'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-white/30 uppercase border-b border-white/10">
              <th className="text-left px-4 py-3 font-medium">Hostel</th>
              <th className="text-left px-4 py-3 font-medium">Plan</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Billing email</th>
              <th className="text-left px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {tenants.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-white/30">
                  No tenants found
                </td>
              </tr>
            ) : (
              tenants.map((t) => (
                <tr key={t.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{t.name}</p>
                    <p className="text-xs text-white/40 font-mono">{t.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-white/60 capitalize">{PLAN_LABEL[t.plan] ?? t.plan}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[t.status] ?? 'text-white/50'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/40 text-xs">{t.billing_email ?? '—'}</td>
                  <td className="px-4 py-3 text-white/40 text-xs">
                    {new Date(t.created_at).toLocaleDateString('en-GH', { dateStyle: 'medium' })}
                    {t.trial_ends_at && (
                      <p className="text-yellow-500/70">
                        Trial ends {new Date(t.trial_ends_at).toLocaleDateString('en-GH', { dateStyle: 'short' })}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/tenants/${t.id}`}
                      className="rounded-md bg-white/10 px-2.5 py-1 text-xs text-white/70 hover:bg-white/20 hover:text-white transition-colors"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
