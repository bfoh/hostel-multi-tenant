import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, CheckCircle, AlertCircle, MinusCircle, Edit3 } from 'lucide-react'

import { getStatementRows } from '@/lib/data/reconciliation'
import { formatGHS } from '@/lib/utils'
import { ReconReviewTable } from '@/components/accounting/recon-review-table'

export const metadata: Metadata = { title: 'Reconciliation Review' }

export default async function ReconUploadPage({ params }: { params: Promise<{ uploadId: string }> }) {
  const { uploadId } = await params
  const rows         = await getStatementRows(uploadId, undefined, 500)

  const matched   = rows.filter((r) => r.status === 'matched').length
  const unmatched = rows.filter((r) => r.status === 'unmatched').length
  const excluded  = rows.filter((r) => r.status === 'excluded').length
  const manual    = rows.filter((r) => r.status === 'manual').length

  const totalCredit = rows.reduce((s, r) => s + r.credit, 0)
  const totalDebit  = rows.reduce((s, r) => s + r.debit,  0)

  const pct = rows.length > 0 ? Math.round(((matched + excluded + manual) / rows.length) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link href="/accounting" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" /> Accounting
        </Link>
        <span className="text-text-disabled">/</span>
        <Link href="/accounting/reconcile" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
          Reconciliation
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="text-sm font-medium text-text-primary">Review</span>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-text-primary">Statement Review</h1>
        <p className="mt-1 text-xs font-mono text-text-tertiary">{uploadId}</p>
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border border-border bg-surface px-5 py-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">{pct}% reconciled</span>
          <span className="text-text-tertiary">{rows.length} rows total</span>
        </div>
        <div className="h-2 w-full rounded-full bg-border overflow-hidden">
          <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
          <Stat icon={CheckCircle} cls="text-success" label="Matched"   value={matched} />
          <Stat icon={AlertCircle} cls="text-warning" label="Unmatched" value={unmatched} />
          <Stat icon={MinusCircle} cls="text-text-tertiary" label="Excluded" value={excluded} />
          <Stat icon={Edit3}       cls="text-brand"   label="Manual"    value={manual} />
        </div>
      </div>

      {/* Credit / debit totals */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-border bg-surface px-4 py-3">
          <p className="text-xs text-text-secondary">Credits (in)</p>
          <p className="mt-1 font-semibold currency-amount text-success">{formatGHS(totalCredit)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface px-4 py-3">
          <p className="text-xs text-text-secondary">Debits (out)</p>
          <p className="mt-1 font-semibold currency-amount text-danger">{formatGHS(totalDebit)}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <p className="text-sm text-text-secondary">No rows found for this upload.</p>
        </div>
      ) : (
        <ReconReviewTable rows={rows} />
      )}
    </div>
  )
}

function Stat({ icon: Icon, cls, label, value }: { icon: React.ElementType; cls: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={`h-3.5 w-3.5 ${cls}`} />
      <span className="text-text-secondary">{label}</span>
      <span className={`font-semibold ${cls}`}>{value}</span>
    </div>
  )
}
