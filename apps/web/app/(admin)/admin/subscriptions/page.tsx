import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = { title: 'Subscriptions — Super Admin' }
export const dynamic = 'force-dynamic'

const STATUS_COLOR: Record<string, string> = {
  active:     'bg-green-900/50 text-green-400',
  trialing:   'bg-blue-900/50 text-blue-400',
  past_due:   'bg-amber-900/50 text-amber-400',
  canceled:   'bg-gray-700 text-gray-400',
  incomplete: 'bg-amber-900/50 text-amber-400',
}

interface Row {
  id: string
  tenant_id: string
  plan_name: string
  amount: number
  currency: string
  status: keyof typeof STATUS_COLOR
  next_payment_at: string | null
  current_period_end: string | null
  canceled_at: string | null
  created_at: string
  paystack_subscription_code: string | null
  tenants: { name: string; slug: string } | null
}

async function getSubscriptions(): Promise<Row[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('tenant_subscriptions')
    .select(`
      id, tenant_id, plan_name, amount, currency, status,
      next_payment_at, current_period_end, canceled_at,
      created_at, paystack_subscription_code,
      tenants(name, slug)
    `)
    .order('created_at', { ascending: false })
    .limit(200)
  return ((data as unknown) as Row[]) ?? []
}

function money(pesewas: number, currency: string) {
  return `${currency} ${(pesewas / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default async function AdminSubscriptionsPage() {
  const subs = await getSubscriptions()

  const counts = subs.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1
    return acc
  }, {})
  const mrr = subs
    .filter((s) => s.status === 'active' || s.status === 'trialing')
    .reduce((n, s) => n + s.amount, 0)

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Subscriptions</h1>
        <p className="mt-1 text-sm text-white/50">
          All hostel tenant subscriptions to the GH Hostels platform (Flow A).
        </p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Active',       value: counts.active   ?? 0 },
          { label: 'Trialing',     value: counts.trialing ?? 0 },
          { label: 'Past due',     value: counts.past_due ?? 0, danger: (counts.past_due ?? 0) > 0 },
          { label: 'MRR',          value: `GHS ${(mrr / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        ].map((k) => (
          <div
            key={k.label}
            className={`rounded-xl border p-4 ${k.danger ? 'border-red-800 bg-red-950/30' : 'border-white/10 bg-white/5'}`}
          >
            <p className="text-xs text-white/40 uppercase tracking-wide">{k.label}</p>
            <p className={`mt-1 text-2xl font-bold ${k.danger ? 'text-red-400' : 'text-white'}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Subscriptions ({subs.length})</h2>
        </div>

        {subs.length === 0 ? (
          <p className="px-4 py-8 text-sm text-white/40 text-center">No subscriptions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-white/30 uppercase">
                <th className="text-left px-4 py-2 font-medium">Hostel</th>
                <th className="text-left px-4 py-2 font-medium">Plan</th>
                <th className="text-left px-4 py-2 font-medium">Amount</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Next payment</th>
                <th className="text-left px-4 py-2 font-medium">Code</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {subs.map((s) => (
                <tr key={s.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{s.tenants?.name ?? '—'}</p>
                    <p className="font-mono text-xs text-white/40">{s.tenants?.slug ?? ''}</p>
                  </td>
                  <td className="px-4 py-3 text-white/80 capitalize">{s.plan_name}</td>
                  <td className="px-4 py-3 text-white/80">{money(s.amount, s.currency)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[s.status] ?? 'text-white/50'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/60 text-xs">
                    {s.next_payment_at
                      ? new Date(s.next_payment_at).toLocaleDateString('en-GH', { dateStyle: 'medium' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-white/40 font-mono text-[11px]">
                    {s.paystack_subscription_code?.slice(0, 16) ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/tenants/${s.tenant_id}`}
                      className="text-xs text-white/40 hover:text-white transition-colors"
                    >
                      Tenant →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
