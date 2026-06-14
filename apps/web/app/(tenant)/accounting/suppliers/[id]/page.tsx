import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { notFound } from 'next/navigation'

import { getSupplierById } from '@/lib/data/suppliers'
import { getChartOfAccounts } from '@/lib/data/accounting'
import { getBills } from '@/lib/data/ap'
import { formatGHS } from '@/lib/utils'
import { SupplierForm } from '@/components/accounting/supplier-form'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

export const metadata: Metadata = { title: 'Supplier' }

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [supplier, accounts] = await Promise.all([
    getSupplierById(id),
    getChartOfAccounts(),
  ])
  if (!supplier) notFound()

  // Bills for this supplier
  const tenantId = await getServerTenantId()
  const admin = createAdminClient()
  const { data: billRows } = tenantId
    ? await (admin as any)
        .from('supplier_bills')
        .select('id, vendor_name, description, bill_date, due_date, amount, paid_amount, status, currency_code')
        .eq('tenant_id', tenantId)
        .eq('supplier_id', id)
        .order('bill_date', { ascending: false })
        .limit(50)
    : { data: [] as any[] }

  const expenseAccounts = accounts
    .filter((a) => a.type === 'expense')
    .map((a) => ({ id: a.id, code: a.code, name: a.name }))

  const totalOutstanding = ((billRows ?? []) as any[])
    .filter((b) => b.status === 'approved' || b.status === 'partial')
    .reduce((s, b) => s + Math.max(0, Number(b.amount) - Number(b.paid_amount)), 0)

  return (
    <div className="space-y-6">
      <div>
        <Link href="/accounting/suppliers" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Back to Suppliers
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">{supplier.name}</h1>
            <p className="mt-1 text-sm text-text-secondary">
              {supplier.is_active ? 'Active vendor' : 'Inactive — won\'t appear in bill capture pickers'}
            </p>
          </div>
          <Link
            href={`/accounting/ap/new?supplier=${supplier.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            New bill for this supplier
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <SupplierForm expenseAccounts={expenseAccounts} initial={supplier} />

        <div className="rounded-xl border border-border bg-surface overflow-x-auto">
          <div className="border-b border-border bg-surface-raised px-4 py-2.5 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Bills</h2>
            <p className="text-xs text-text-tertiary">
              Outstanding: <strong className="text-text-primary">{formatGHS(totalOutstanding)}</strong>
            </p>
          </div>
          {(!billRows || billRows.length === 0) ? (
            <p className="px-4 py-8 text-center text-sm text-text-tertiary">No bills recorded against this supplier yet.</p>
          ) : (
            <table className="w-full">
              <thead className="bg-surface">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-text-tertiary">Bill</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-text-tertiary w-20">Due</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-text-tertiary w-20">Status</th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium text-text-tertiary w-28">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {((billRows ?? []) as any[]).map((b) => {
                  const bal = Math.max(0, Number(b.amount) - Number(b.paid_amount))
                  return (
                    <tr key={b.id} className="hover:bg-surface-raised/50 transition-colors">
                      <td className="px-3 py-2">
                        <Link href={`/accounting/ap/${b.id}`} className="text-sm text-text-primary hover:text-brand transition-colors">
                          {b.description}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs text-text-secondary">
                        {new Date(b.due_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-text-secondary capitalize">{b.status}</td>
                      <td className="px-3 py-2 text-right text-sm tabular-nums currency-amount text-text-primary">
                        {bal > 0 ? formatGHS(bal) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
