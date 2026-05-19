import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getServerTenantId } from '@/lib/auth/tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRevenuePointItems, getRevenuePointSales } from '@/lib/data/revenue-points'
import { formatGHS } from '@/lib/utils'
import { notFound } from 'next/navigation'
import { POSClient } from './pos-client'

export const metadata: Metadata = { title: 'Point of Sale' }

export default async function RevenuePointPOSPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const tenantId = await getServerTenantId()
  if (!tenantId) notFound()

  const supabase = createAdminClient()

  // Get revenue point details
  const { data: point } = await supabase
    .from('revenue_points')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!point) notFound()

  const [items, recentSales, tenantRow] = await Promise.all([
    getRevenuePointItems(tenantId, id),
    getRevenuePointSales(tenantId, id, 15),
    supabase.from('tenants').select('paystack_subaccount_code').eq('id', tenantId).single(),
  ])
  const paystackReady = !!process.env.PAYSTACK_SECRET_KEY && !!tenantRow.data?.paystack_subaccount_code

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/revenue-points"
          className="mb-2 inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-3 w-3" /> Revenue Points
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">{String(point.name)}</h1>
        <p className="mt-0.5 text-sm text-text-secondary">Point of Sale</p>
      </div>

      <POSClient
        revenuePointId={id}
        items={items}
        paystackEnabled={paystackReady}
      />

      {/* Recent sales */}
      {recentSales.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="border-b border-border bg-surface-sunken px-5 py-3">
            <h2 className="text-sm font-semibold text-text-primary">Recent Sales</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken/50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Item</th>
                <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-text-tertiary">Qty</th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">Amount</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Method</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary hidden md:table-cell">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentSales.map((s) => (
                <tr key={s.id} className="hover:bg-surface-raised transition-colors">
                  <td className="px-4 py-2 text-text-primary">{s.itemName}</td>
                  <td className="px-4 py-2 text-center text-text-secondary">{s.quantity}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-text-primary">{formatGHS(s.total_amount)}</td>
                  <td className="px-4 py-2 text-text-secondary text-xs capitalize">{s.payment_method?.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2 text-text-tertiary text-xs hidden md:table-cell">
                    {s.sold_at ? new Date(s.sold_at).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
