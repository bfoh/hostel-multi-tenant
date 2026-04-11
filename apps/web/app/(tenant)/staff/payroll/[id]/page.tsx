import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, Download } from 'lucide-react'

import { getPayrollRunById } from '@/lib/data/staff'
import { formatGHS, formatDate } from '@/lib/utils'
import { PayrollStatusButton } from '@/components/staff/payroll-status-button'

export const metadata: Metadata = { title: 'Payroll Run' }

export default async function PayrollRunPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const run = await getPayrollRunById(id)

  if (!run) notFound()

  const items = Array.isArray(run.items) ? run.items : []
  const totalNet = items.reduce((sum, i) => sum + (i.net_salary ?? 0), 0)
  const totalSSNITEmployer = items.reduce((sum, i) => sum + (i.ssnit_employer ?? 0), 0)
  const totalPAYE = items.reduce((sum, i) => sum + (i.paye_tax ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/staff/payroll" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
            <ChevronLeft className="h-4 w-4" /> Payroll
          </Link>
          <span className="text-text-disabled">/</span>
          <span className="text-sm text-text-primary">
            {formatDate(run.period_start)} – {formatDate(run.period_end)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/payroll/${id}/payslip`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised transition-colors"
          >
            <Download className="h-4 w-4" />
            Download payslips
          </a>
          <PayrollStatusButton runId={id} currentStatus={run.status} />
        </div>
      </div>

      {/* ── Summary cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Total gross" value={formatGHS(run.total_gross ?? 0)} />
        <SummaryCard label="Total PAYE" value={formatGHS(totalPAYE)} sub="to GRA" />
        <SummaryCard label="SSNIT (employer)" value={formatGHS(totalSSNITEmployer)} sub="13%" />
        <SummaryCard label="Total net" value={formatGHS(totalNet)} highlight />
      </div>

      {/* ── Items table ──────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Staff</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary">Basic</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary">SSNIT (Empl.)</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary">SSNIT (Emplr.)</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary">PAYE</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary">Deductions</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary font-semibold">Net pay</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map(item => {
              const s = Array.isArray(item.staff) ? item.staff[0] : item.staff
              const totalDed = (item.ssnit_employee ?? 0) + (item.paye_tax ?? 0) + (item.other_deductions ?? 0)
              return (
                <tr key={item.id} className="hover:bg-surface-raised transition-colors">
                  <td className="px-4 py-3">
                    {s ? (
                      <Link href={`/staff/${s.id}?tab=payroll`} className="block">
                        <p className="text-sm font-medium text-text-primary hover:text-brand transition-colors">
                          {s.first_name} {s.last_name}
                        </p>
                        <p className="text-xs text-text-tertiary">{s.job_title ?? ''}</p>
                      </Link>
                    ) : <span className="text-sm text-text-secondary">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-text-primary currency-amount">{formatGHS(item.basic_salary ?? 0)}</td>
                  <td className="px-4 py-3 text-right text-sm text-danger currency-amount">{formatGHS(item.ssnit_employee ?? 0)}</td>
                  <td className="px-4 py-3 text-right text-sm text-text-secondary currency-amount">{formatGHS(item.ssnit_employer ?? 0)}</td>
                  <td className="px-4 py-3 text-right text-sm text-danger currency-amount">{formatGHS(item.paye_tax ?? 0)}</td>
                  <td className="px-4 py-3 text-right text-sm text-danger currency-amount">{formatGHS(totalDed)}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-success currency-amount">{formatGHS(item.net_salary ?? 0)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-surface-raised">
              <td className="px-4 py-3 text-sm font-semibold text-text-primary">Totals</td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-text-primary currency-amount">{formatGHS(run.total_gross ?? 0)}</td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-danger currency-amount">
                {formatGHS(items.reduce((s, i) => s + (i.ssnit_employee ?? 0), 0))}
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-text-secondary currency-amount">{formatGHS(totalSSNITEmployer)}</td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-danger currency-amount">{formatGHS(totalPAYE)}</td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-danger currency-amount">
                {formatGHS(items.reduce((s, i) => s + (i.ssnit_employee ?? 0) + (i.paye_tax ?? 0) + (i.other_deductions ?? 0), 0))}
              </td>
              <td className="px-4 py-3 text-right text-sm font-bold text-success currency-amount">{formatGHS(totalNet)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {run.notes && (
        <p className="text-sm text-text-secondary">Notes: {run.notes}</p>
      )}
    </div>
  )
}

function SummaryCard({ label, value, sub, highlight }: {
  label: string; value: string; sub?: string; highlight?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={`mt-1 text-xl font-bold currency-amount ${highlight ? 'text-success' : 'text-text-primary'}`}>{value}</p>
      {sub && <p className="text-[11px] text-text-tertiary">{sub}</p>}
    </div>
  )
}
