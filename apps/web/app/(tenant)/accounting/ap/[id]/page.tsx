import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, FileText, Receipt } from 'lucide-react'
import { notFound } from 'next/navigation'

import { getServerTenantId } from '@/lib/auth/tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatGHS } from '@/lib/utils'
import { BillActionsPanel } from '@/components/accounting/bill-actions-panel'
import type { BillStatus } from '@/lib/data/ap'

export const metadata: Metadata = { title: 'Supplier Bill' }

const STATUS_BADGE: Record<BillStatus, string> = {
  draft:     'bg-surface-raised text-text-secondary border-border',
  approved:  'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200/40',
  partial:   'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200/40',
  paid:      'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border-green-200/40',
  cancelled: 'bg-surface-raised text-text-tertiary line-through border-border',
}

export default async function BillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const tenantId = await getServerTenantId()
  if (!tenantId) notFound()

  const supabase = createAdminClient()

  const [{ data: bill }, { data: payments }] = await Promise.all([
    (supabase as any)
      .from('supplier_bills')
      .select(`*, expense_account:chart_of_accounts(code, name)`)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    (supabase as any)
      .from('supplier_bill_payments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('bill_id', id)
      .order('paid_at', { ascending: false }),
  ])

  if (!bill) notFound()

  const balance = Math.max(0, Number(bill.amount) - Number(bill.paid_amount))
  const expenseAccount = Array.isArray(bill.expense_account) ? bill.expense_account[0] : bill.expense_account

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/accounting/ap"
          className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Accounts Payable
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">{bill.vendor_name}</h1>
            <p className="mt-1 text-sm text-text-secondary">{bill.description}</p>
          </div>
          <span className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_BADGE[bill.status as BillStatus]}`}>
            {bill.status}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {/* Summary */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="border-b border-border bg-surface-raised px-4 py-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Summary</h2>
            </div>
            <dl className="divide-y divide-border/40">
              <Row label="Bill number" value={bill.bill_number ?? '—'} />
              <Row label="Bill date"   value={new Date(bill.bill_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })} />
              <Row label="Due date"    value={new Date(bill.due_date) .toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })} />
              <Row label="Category"    value={<span className="capitalize">{bill.category}</span>} />
              <Row label="Vendor contact" value={bill.vendor_contact ?? '—'} />
              <Row label="Expense account" value={expenseAccount ? `${expenseAccount.code} · ${expenseAccount.name}` : 'Default (5050)'} />
              {bill.currency_code && bill.currency_code !== 'GHS' && bill.original_amount && (
                <Row
                  label="Foreign currency"
                  value={
                    <span className="text-text-primary">
                      {bill.currency_code} {(Number(bill.original_amount) / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}
                      <span className="ml-2 text-[11px] text-text-tertiary">@ rate {Number(bill.fx_rate_used).toFixed(4)}</span>
                    </span>
                  }
                />
              )}
              {bill.notes && <Row label="Notes" value={bill.notes} />}
            </dl>
            <div className="grid grid-cols-3 gap-4 border-t border-border bg-surface-raised px-4 py-3 text-sm">
              <Money label="Bill amount" value={bill.amount} tone="text-text-primary" />
              <Money label="Paid"        value={bill.paid_amount} tone="text-text-secondary" />
              <Money label="Balance"     value={balance} tone={balance > 0 ? 'text-danger' : 'text-success'} />
            </div>
          </div>

          {/* Payment history */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="border-b border-border bg-surface-raised px-4 py-2.5 flex items-center gap-2">
              <Receipt className="h-3.5 w-3.5 text-text-tertiary" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Payments</h2>
            </div>
            {(!payments || payments.length === 0) ? (
              <p className="px-4 py-6 text-sm text-text-tertiary text-center">No payments recorded yet.</p>
            ) : (
              <div className="divide-y divide-border/40">
                {(payments as any[]).map((p) => (
                  <div key={p.id} className="px-4 py-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="text-text-primary">
                        {new Date(p.paid_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: '2-digit' })} · <span className="capitalize">{p.payment_method.replace('_', ' ')}</span>
                      </p>
                      {p.reference && <p className="mt-0.5 text-[11px] text-text-tertiary">Ref: {p.reference}</p>}
                    </div>
                    <p className="font-semibold currency-amount text-text-primary">{formatGHS(p.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <BillActionsPanel
          billId={bill.id}
          status={bill.status as BillStatus}
          outstanding={balance}
        />
      </div>

      {bill.approval_entry_id && (
        <div className="rounded-xl border border-border bg-surface-raised px-4 py-3 text-xs text-text-secondary inline-flex items-center gap-2">
          <FileText className="h-3.5 w-3.5" />
          Approval journal entry posted ·{' '}
          <Link href={`/accounting/journal`} className="text-brand hover:opacity-80 transition-opacity">
            view in journal
          </Link>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <dt className="text-text-tertiary">{label}</dt>
      <dd className="text-text-primary text-right">{value}</dd>
    </div>
  )
}

function Money({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <p className="text-[11px] text-text-tertiary">{label}</p>
      <p className={`mt-0.5 font-bold currency-amount ${tone}`}>{formatGHS(value)}</p>
    </div>
  )
}
