import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = { title: 'Payouts — Super Admin' }
export const dynamic = 'force-dynamic'

interface Row {
  id: string
  name: string
  slug: string
  status: string
  paystack_subaccount_code: string | null
  paystack_settlement_bank: string | null
  paystack_bank_account_no: string | null
  paystack_account_name: string | null
  paystack_connected_at: string | null
}

async function getRows(): Promise<Row[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('tenants')
    .select(`
      id, name, slug, status,
      paystack_subaccount_code, paystack_settlement_bank,
      paystack_bank_account_no, paystack_account_name, paystack_connected_at
    `)
    .order('created_at', { ascending: false })
    .limit(500)
  return (data ?? []) as Row[]
}

export default async function AdminPayoutsPage() {
  const rows = await getRows()
  const connected = rows.filter((r) => r.paystack_subaccount_code)
  const missing   = rows.filter((r) => !r.paystack_subaccount_code)

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Tenant Payouts</h1>
        <p className="mt-1 text-sm text-white/50">
          Paystack subaccounts used to route guest payments (Flow B). 100% of each guest charge
          settles to the hostel&apos;s own bank — the platform takes no cut.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/40 uppercase tracking-wide">Total tenants</p>
          <p className="mt-1 text-2xl font-bold text-white">{rows.length}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/40 uppercase tracking-wide">Connected</p>
          <p className="mt-1 text-2xl font-bold text-green-400">{connected.length}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/40 uppercase tracking-wide">Missing payout</p>
          <p className="mt-1 text-2xl font-bold text-amber-400">{missing.length}</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">All tenants</h2>
        </div>

        {rows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-white/40 text-center">No tenants.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-white/30 uppercase">
                <th className="text-left px-4 py-2 font-medium">Hostel</th>
                <th className="text-left px-4 py-2 font-medium">Bank</th>
                <th className="text-left px-4 py-2 font-medium">Account #</th>
                <th className="text-left px-4 py-2 font-medium">Account name</th>
                <th className="text-left px-4 py-2 font-medium">Subaccount code</th>
                <th className="text-left px-4 py-2 font-medium">Connected</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{r.name}</p>
                    <p className="font-mono text-xs text-white/40">{r.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-white/70 text-xs">
                    {r.paystack_settlement_bank ?? <span className="text-amber-400">— not set</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-white/70">
                    {r.paystack_bank_account_no ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-white/70 text-xs">
                    {r.paystack_account_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-white/40">
                    {r.paystack_subaccount_code ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-white/40 text-xs">
                    {r.paystack_connected_at
                      ? new Date(r.paystack_connected_at).toLocaleDateString('en-GH', { dateStyle: 'medium' })
                      : <span className="text-amber-400">never</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/tenants/${r.id}`}
                      className="text-xs text-white/40 hover:text-white transition-colors"
                    >
                      Manage →
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
