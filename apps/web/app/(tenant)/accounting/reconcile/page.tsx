import type { Metadata } from 'next'
import { Upload, CheckCircle, AlertCircle, MinusCircle, Pencil } from 'lucide-react'

import { getReconSummary } from '@/lib/data/reconciliation'
import { formatGHS } from '@/lib/utils'
import { ReconUploadForm } from '@/components/accounting/recon-upload-form'

export const metadata: Metadata = { title: 'Bank Reconciliation' }

export default async function ReconcilePage() {
  const summary = await getReconSummary()

  const stats = [
    {
      label: 'Total Rows',
      value: summary.totalRows.toString(),
      icon: Upload,
      cls: 'text-text-primary',
    },
    {
      label: 'Matched',
      value: summary.matched.toString(),
      icon: CheckCircle,
      cls: 'text-success',
    },
    {
      label: 'Unmatched',
      value: summary.unmatched.toString(),
      icon: AlertCircle,
      cls: 'text-warning',
    },
    {
      label: 'Excluded',
      value: summary.excluded.toString(),
      icon: MinusCircle,
      cls: 'text-text-tertiary',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Bank Reconciliation</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Upload a CSV statement from your bank or MoMo provider. Rows are auto-matched to journal entries.
        </p>
      </div>

      {/* Summary stats */}
      {summary.totalRows > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => {
            const Icon = s.icon
            return (
              <div key={s.label} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-text-secondary">{s.label}</p>
                  <Icon className={`h-4 w-4 ${s.cls}`} />
                </div>
                <p className={`mt-2 text-xl font-bold ${s.cls}`}>{s.value}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Credit summary */}
      {summary.totalRows > 0 && (
        <div className="rounded-xl border border-border bg-surface px-5 py-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 text-sm">
            <div>
              <p className="text-xs text-text-secondary">Total Credits (in)</p>
              <p className="mt-1 font-semibold currency-amount text-success">{formatGHS(summary.totalCredit)}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Total Debits (out)</p>
              <p className="mt-1 font-semibold currency-amount text-danger">{formatGHS(summary.totalDebit)}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Unmatched Credits</p>
              <p className="mt-1 font-semibold currency-amount text-warning">{formatGHS(summary.unmatchedCredit)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Upload form */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Upload className="h-4 w-4 text-brand" />
          Upload New Statement
        </h2>
        <ReconUploadForm />
      </div>

      {/* Manual review note */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm dark:border-blue-800 dark:bg-blue-950/40">
        <p className="font-medium text-blue-800 dark:text-blue-300 flex items-center gap-2">
          <Pencil className="h-4 w-4" /> Auto-matching rules
        </p>
        <p className="mt-1 text-blue-700 dark:text-blue-400">
          A statement row is auto-matched when a journal line has the same amount (±5p), a date within ±2 days,
          and a matching reference (if provided). Unmatched rows must be reviewed manually.
        </p>
      </div>
    </div>
  )
}
