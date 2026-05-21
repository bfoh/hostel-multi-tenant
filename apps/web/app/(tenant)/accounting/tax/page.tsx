import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarClock, AlertTriangle, Receipt, FileText, BookOpen } from 'lucide-react'

import { getTaxReturn, getFilingCalendar, type FilingObligation } from '@/lib/data/tax'
import { getTaxFilings, type TaxFilingKind } from '@/lib/data/tax-filings'
import { formatGHS } from '@/lib/utils'
import { ExportCsvButton } from '@/components/accounting/export-csv-button'
import { BudgetMonthPicker } from '@/components/accounting/budget-client'
import { MarkFiledButton } from '@/components/accounting/mark-filed-button'

export const metadata: Metadata = { title: 'Tax · Calendar & Returns' }

const STATUS_TONE: Record<FilingObligation['status'], { dot: string; text: string; bg: string }> = {
  upcoming:  { dot: 'bg-text-tertiary', text: 'text-text-secondary', bg: 'bg-surface' },
  'due-soon':{ dot: 'bg-amber-500',     text: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  overdue:   { dot: 'bg-red-500',       text: 'text-red-700 dark:text-red-300',     bg: 'bg-red-50 dark:bg-red-950/30' },
}

export default async function TaxPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const sp = await searchParams
  const now = new Date()
  // Default to the *previous* month — the one most likely being filed now
  const defaultDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const year  = sp.year  ? parseInt(sp.year,  10) : defaultDate.getFullYear()
  const month = sp.month ? parseInt(sp.month, 10) : defaultDate.getMonth() + 1

  const [ret, calendar, filings] = await Promise.all([
    getTaxReturn(year, month),
    getFilingCalendar(),
    getTaxFilings(200),
  ])

  const filedSet = new Set(filings.filter((f) => f.status === 'filed').map((f) => `${f.kind}-${f.period_year}-${f.period_month ?? 0}`))
  function filingKindFor(kind: FilingObligation['kind']): TaxFilingKind {
    if (kind === 'PAYE')  return 'paye'
    if (kind === 'SSNIT') return 'ssnit'
    return 'vat_levies'
  }

  if (!ret) {
    return (
      <div className="rounded-xl border border-border bg-surface p-12 text-center">
        <p className="text-sm text-text-secondary">No tenant context.</p>
      </div>
    )
  }

  const vatCsv = [
    ['VAT charged (output)',     (ret.vat.charged    / 100).toFixed(2)],
    ['VAT reclaimed (input)',    (ret.vat.reclaimed  / 100).toFixed(2)],
    ['Net VAT due',              (ret.vat.netDue     / 100).toFixed(2)],
    ['NHIL (2.5%)',              (ret.nhil           / 100).toFixed(2)],
    ['GETFund (2.5%)',           (ret.getfund        / 100).toFixed(2)],
    ['PAYE',                     (ret.paye           / 100).toFixed(2)],
    ['SSNIT — employer (13%)',  (ret.ssnitEmployer  / 100).toFixed(2)],
    ['SSNIT — employee (5.5%)', (ret.ssnitEmployee  / 100).toFixed(2)],
    ['Grand total payable',     (ret.grandTotal     / 100).toFixed(2)],
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Tax Calendar &amp; Returns</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Ghana statutory filings · VAT / NHIL / GETFund / PAYE / SSNIT · figures derived from journal activity
          </p>
        </div>
        <Link
          href="/accounting/tax/filings"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Filing register
        </Link>
      </div>

      {/* Calendar */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="border-b border-border bg-surface-raised px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-semibold text-text-primary">Upcoming filings</h2>
          </div>
          <span className="text-xs text-text-tertiary">{calendar.length} obligation{calendar.length === 1 ? '' : 's'}</span>
        </div>

        {calendar.length === 0 ? (
          <p className="px-4 py-6 text-sm text-text-tertiary text-center">No upcoming filings.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {calendar.map((o) => {
              const tone = STATUS_TONE[o.status]
              return (
                <li key={o.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary">{o.kind}</p>
                      <p className="mt-0.5 text-xs text-text-secondary">
                        For {o.period} · due{' '}
                        <strong className="text-text-primary">
                          {new Date(o.dueDate).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </strong>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-right">
                    <div>
                      <p className="text-xs text-text-tertiary">Amount due</p>
                      <p className="text-sm font-semibold currency-amount text-text-primary">{formatGHS(o.amountDue)}</p>
                    </div>
                    <div className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone.bg} ${tone.text}`}>
                      {o.status === 'overdue'
                        ? `${Math.abs(o.daysUntilDue)}d overdue`
                        : o.status === 'due-soon'
                        ? `Due in ${o.daysUntilDue}d`
                        : `${o.daysUntilDue}d`}
                    </div>
                    <MarkFiledButton
                      kind={filingKindFor(o.kind)}
                      period_year={o.year}
                      period_month={o.month}
                      due_date={o.dueDate}
                      amount_due={o.amountDue}
                      alreadyFiled={filedSet.has(`${filingKindFor(o.kind)}-${o.year}-${o.month}`)}
                      label={o.kind}
                    />
                    <Link
                      href={`/accounting/tax?year=${o.year}&month=${o.month}`}
                      className="text-xs text-brand hover:opacity-80 transition-opacity"
                    >
                      Open return →
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Return summary */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-brand" />
          <div>
            <h2 className="text-base font-semibold text-text-primary">Return for {ret.monthLabel}</h2>
            <p className="mt-0.5 text-xs text-text-tertiary">{ret.periodStart} → {ret.periodEnd}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BudgetMonthPicker year={year} month={month} />
          <ExportCsvButton
            filename={`tax-return-${year}-${String(month).padStart(2, '0')}`}
            headers={['Line', 'Amount (GHS)']}
            rows={vatCsv}
          />
        </div>
      </div>

      {/* VAT block */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="border-b border-border bg-surface-raised px-4 py-2.5 flex items-center gap-2">
          <Receipt className="h-3.5 w-3.5 text-brand" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">VAT, NHIL &amp; GETFund</h3>
        </div>
        <div className="divide-y divide-border/40">
          <ReturnRow label="VAT charged (output)"          value={ret.vat.charged} />
          <ReturnRow label="VAT reclaimed (input)"         value={ret.vat.reclaimed} muted hint="Wire up an Input VAT account (e.g. 1400) to populate this line." />
          <ReturnRow label="Net VAT due"                   value={ret.vat.netDue}   bold tone="primary" />
          <ReturnRow label="NHIL (2.5%)"                    value={ret.nhil} />
          <ReturnRow label="GETFund (2.5%)"                 value={ret.getfund} />
          <ReturnRow label="VAT + Levies subtotal"          value={ret.vat.netDue + ret.totalLevies} bold tone="brand" />
        </div>
      </div>

      {/* Payroll block */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="border-b border-border bg-surface-raised px-4 py-2.5 flex items-center gap-2">
          <Receipt className="h-3.5 w-3.5 text-brand" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">PAYE &amp; SSNIT</h3>
        </div>
        <div className="divide-y divide-border/40">
          <ReturnRow label="PAYE income tax"                 value={ret.paye} />
          <ReturnRow label="SSNIT — employer (13%)"          value={ret.ssnitEmployer} />
          <ReturnRow label="SSNIT — employee (5.5%)"         value={ret.ssnitEmployee} />
          <ReturnRow label="Payroll taxes subtotal"          value={ret.totalPayroll} bold tone="brand" />
        </div>
      </div>

      <div className="rounded-xl border-2 border-brand/30 bg-brand/5 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-text-primary">Total payable to GRA &amp; SSNIT</p>
          <p className="mt-0.5 text-xs text-text-tertiary">All statutory liabilities accrued in {ret.monthLabel}</p>
        </div>
        <p className="text-2xl font-bold currency-amount text-brand">{formatGHS(ret.grandTotal)}</p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Pre-filing checklist</p>
          <ul className="mt-1 list-disc pl-5 space-y-0.5">
            <li>Reconcile bank statements through {ret.periodEnd} before submitting.</li>
            <li>Confirm payroll for {ret.monthLabel} has been posted (auto-journals trigger on `paid` status).</li>
            <li>Cross-check VAT charged against revenue recognised in P&amp;L for the same period.</li>
            <li>File and pay via the GRA Taxpayers Portal (taxpayersportal.com).</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function ReturnRow({
  label, value, hint, bold, muted, tone,
}: {
  label: string
  value: number
  hint?: string
  bold?: boolean
  muted?: boolean
  tone?: 'brand' | 'primary'
}) {
  const valueColor = tone === 'brand' ? 'text-brand' : tone === 'primary' ? 'text-text-primary' : muted ? 'text-text-tertiary' : 'text-text-primary'
  return (
    <div className={`flex items-start justify-between gap-3 px-4 py-2.5 text-sm ${bold ? 'bg-surface-raised' : ''}`}>
      <div className="min-w-0">
        <p className={`${bold ? 'font-semibold' : ''} text-text-primary`}>{label}</p>
        {hint && <p className="mt-0.5 text-[11px] text-text-tertiary">{hint}</p>}
      </div>
      <p className={`${bold ? 'font-bold' : ''} currency-amount tabular-nums ${valueColor}`}>{formatGHS(value)}</p>
    </div>
  )
}
