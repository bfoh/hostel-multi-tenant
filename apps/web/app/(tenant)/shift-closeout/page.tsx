import type { Metadata } from 'next'
import { getServerTenantId } from '@/lib/auth/tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { ShiftCloseoutForm } from './closeout-form'

export const metadata: Metadata = { title: 'Shift Close-Out' }

export default async function ShiftCloseoutPage() {
  const tenantId = await getServerTenantId()
  if (!tenantId) notFound()

  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  // Get recent close-outs for this tenant
  const { data: recentCloseouts } = await supabase
    .from('shift_closeouts')
    .select('id, shift_date, system_cash, declared_cash, discrepancy, system_digital, payment_count, status, created_at')
    .eq('tenant_id', tenantId)
    .order('shift_date', { ascending: false })
    .limit(10)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Shift Close-Out</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          End your shift by declaring the cash you collected. The system will compare against recorded payments.
        </p>
      </div>

      <ShiftCloseoutForm today={today} />

      {/* Recent close-outs */}
      {(recentCloseouts?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="border-b border-border bg-surface-sunken px-5 py-3">
            <h2 className="font-semibold text-text-primary text-sm">Recent Close-Outs</h2>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken/50">
              <tr>
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Date</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">System Cash</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">Declared</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">Discrepancy</th>
                <th className="px-5 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-text-tertiary">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(recentCloseouts as any[])?.map((c: any) => {
                const disc = (c as any).discrepancy ?? 0
                return (
                  <tr key={c.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-5 py-2.5 text-text-primary">
                      {new Date(c.shift_date).toLocaleDateString('en-GH', { dateStyle: 'medium' })}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-text-secondary">
                      GH₵ {((c.system_cash ?? 0) / 100).toFixed(2)}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-text-secondary">
                      GH₵ {((c.declared_cash ?? 0) / 100).toFixed(2)}
                    </td>
                    <td className={`px-5 py-2.5 text-right font-mono font-semibold ${
                      disc === 0 ? 'text-success' : disc < 0 ? 'text-danger' : 'text-warning-fg'
                    }`}>
                      {disc === 0 ? '—' : `${disc > 0 ? '+' : ''}GH₵ ${(disc / 100).toFixed(2)}`}
                    </td>
                    <td className="px-5 py-2.5 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.status === 'approved' ? 'bg-success/10 text-success' :
                        c.status === 'flagged'  ? 'bg-danger/10 text-danger' :
                        'bg-warning/10 text-warning-fg'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
