import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Shield, AlertTriangle, CheckCircle } from 'lucide-react'
import { getServerTenantId } from '@/lib/auth/tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { CloseoutActions } from './closeout-actions'

export const metadata: Metadata = { title: 'Shift Close-Out Review' }

export default async function CloseoutReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const tenantId = await getServerTenantId()
  if (!tenantId) notFound()

  const { filter = 'all' } = await searchParams
  const supabase = createAdminClient()

  let query = supabase
    .from('shift_closeouts')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('shift_date', { ascending: false })
    .limit(50)

  if (filter === 'flagged') {
    query = query.eq('status', 'flagged')
  } else if (filter === 'pending') {
    query = query.in('status', ['pending', 'flagged'])
  }

  const { data } = await query
  const closeouts = (data ?? []) as any[]

  // Get staff names
  const staffIds = [...new Set((closeouts as any[] ?? []).map((c: any) => c.staff_id as string))]
  const { data: members } = await supabase
    .from('tenant_members')
    .select('user_id, user:auth_user_id(email, raw_user_meta_data)')
    .eq('tenant_id', tenantId)
    .in('user_id', staffIds.length > 0 ? staffIds : ['_none_'])

  const nameMap = new Map<string, string>()
  for (const m of members ?? []) {
    const meta = (m as any).user?.raw_user_meta_data ?? {}
    nameMap.set(m.user_id, meta.full_name ?? meta.name ?? (m as any).user?.email ?? 'Unknown')
  }

  const flaggedCount = (closeouts ?? []).filter(c => c.status === 'flagged').length
  const pendingCount = (closeouts ?? []).filter(c => c.status === 'pending').length

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/shift-closeout"
          className="mb-2 inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-3 w-3" /> Shift Close-Out
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">Close-Out Review</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Review and approve staff shift close-outs. Flagged entries have a discrepancy &gt; 5% or &gt; GHS 50.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-danger/20 bg-danger/5 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-danger" />
            <p className="text-xs text-danger">Flagged</p>
          </div>
          <p className="mt-1 text-xl font-bold text-danger">{flaggedCount}</p>
        </div>
        <div className="rounded-xl border border-warning/20 bg-warning/5 p-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-warning-fg" />
            <p className="text-xs text-warning-fg">Pending</p>
          </div>
          <p className="mt-1 text-xl font-bold text-warning-fg">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-success/20 bg-success/5 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-success" />
            <p className="text-xs text-success">Approved</p>
          </div>
          <p className="mt-1 text-xl font-bold text-success">
            {(closeouts ?? []).filter(c => c.status === 'approved').length}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {['all', 'pending', 'flagged'].map((f) => (
          <Link
            key={f}
            href={`/shift-closeout/review?filter=${f}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-brand text-white'
                : 'bg-surface border border-border text-text-secondary hover:bg-surface-sunken'
            }`}
          >
            {f}
          </Link>
        ))}
      </div>

      {/* Table */}
      {(closeouts?.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <CheckCircle className="h-8 w-8 text-text-disabled" />
          <p className="font-medium text-text-primary">No close-outs to review</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-sunken">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Staff</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">System</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">Declared</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">Discrepancy</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-text-tertiary">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary hidden md:table-cell">Notes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {closeouts?.map((c) => {
                const disc = (c as any).discrepancy ?? 0
                return (
                  <tr key={c.id} className={`transition-colors ${
                    c.status === 'flagged' ? 'bg-danger/5 hover:bg-danger/10' : 'hover:bg-surface-raised'
                  }`}>
                    <td className="px-4 py-3 text-text-primary whitespace-nowrap">
                      {new Date(c.shift_date).toLocaleDateString('en-GH', { dateStyle: 'medium' })}
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      {nameMap.get(c.staff_id) ?? c.staff_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-text-secondary">
                      GH₵ {((c.system_cash ?? 0) / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-text-secondary">
                      GH₵ {((c.declared_cash ?? 0) / 100).toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${
                      disc === 0 ? 'text-success' : disc < 0 ? 'text-danger' : 'text-warning-fg'
                    }`}>
                      {disc === 0 ? '✓' : `${disc > 0 ? '+' : ''}GH₵ ${(disc / 100).toFixed(2)}`}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.status === 'approved' ? 'bg-success/10 text-success' :
                        c.status === 'flagged'  ? 'bg-danger/10 text-danger' :
                        'bg-warning/10 text-warning-fg'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-tertiary text-xs hidden md:table-cell max-w-[200px] truncate">
                      {c.notes ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {c.status !== 'approved' && (
                        <CloseoutActions closeoutId={c.id} />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
