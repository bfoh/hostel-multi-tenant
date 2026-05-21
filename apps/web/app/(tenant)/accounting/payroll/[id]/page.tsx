import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { notFound } from 'next/navigation'

import { getPayrollRegister } from '@/lib/data/payroll-register'
import { formatGHS } from '@/lib/utils'
import { ExportCsvButton } from '@/components/accounting/export-csv-button'

export const metadata: Metadata = { title: 'Payroll Register' }

export default async function PayrollRegisterPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const r = await getPayrollRegister(id)
  if (!r) notFound()

  const csvRows = r.lines.map((l) => [
    l.staff_name,
    l.employee_id ?? '',
    l.ssnit_number ?? '',
    (l.basic_salary    / 100).toFixed(2),
    (l.allowances      / 100).toFixed(2),
    (l.gross_pay       / 100).toFixed(2),
    (l.ssnit_employee  / 100).toFixed(2),
    (l.paye_tax        / 100).toFixed(2),
    (l.other_deductions/ 100).toFixed(2),
    (l.total_deductions/ 100).toFixed(2),
    (l.net_salary      / 100).toFixed(2),
    (l.ssnit_employer  / 100).toFixed(2),
  ])

  return (
    <div className="space-y-6">
      <div>
        <Link href="/accounting/payroll" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Back to Payroll Register
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">
              {new Date(r.period_start).toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })} —{' '}
              {new Date(r.period_end).toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })}
            </h1>
            <p className="mt-1 text-sm text-text-secondary capitalize">Status: {r.status}{r.paid_at ? ` · paid ${new Date(r.paid_at).toLocaleDateString('en-GH')}` : ''}</p>
          </div>
          <ExportCsvButton
            filename={`payroll-${r.period_start}-${r.period_end}`}
            headers={['Employee', 'Emp ID', 'SSNIT #', 'Basic', 'Allowances', 'Gross', 'SSNIT 5.5%', 'PAYE', 'Other ded.', 'Total ded.', 'Net pay', 'SSNIT employer 13%']}
            rows={csvRows}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi label="Gross pay"        value={formatGHS(r.totals.gross)} tone="primary" />
        <Kpi label="Total deductions" value={formatGHS(r.totals.total_deductions)} tone="danger" />
        <Kpi label="Net to bank"      value={formatGHS(r.totals.net)} tone="success" sublabel={`${r.lines.length} employee${r.lines.length === 1 ? '' : 's'}`} />
        <Kpi label="Total payroll cost" value={formatGHS(r.totals.payroll_cost)} sublabel="Gross + employer SSNIT" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        {r.lines.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-tertiary">No payroll lines.</p>
        ) : (
          <table className="w-full min-w-[1100px]">
            <thead className="bg-surface-raised">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-[11px] font-medium text-text-tertiary">Employee</th>
                <th className="px-3 py-2 text-right text-[11px] font-medium text-text-tertiary w-24">Basic</th>
                <th className="px-3 py-2 text-right text-[11px] font-medium text-text-tertiary w-24">Allow.</th>
                <th className="px-3 py-2 text-right text-[11px] font-medium text-text-tertiary w-24">Gross</th>
                <th className="px-3 py-2 text-right text-[11px] font-medium text-text-tertiary w-24">SSNIT 5.5%</th>
                <th className="px-3 py-2 text-right text-[11px] font-medium text-text-tertiary w-24">PAYE</th>
                <th className="px-3 py-2 text-right text-[11px] font-medium text-text-tertiary w-24">Other</th>
                <th className="px-3 py-2 text-right text-[11px] font-medium text-text-tertiary w-24">Net</th>
                <th className="px-3 py-2 text-right text-[11px] font-medium text-text-tertiary w-28">Emplr SSNIT 13%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {r.lines.map((l) => (
                <tr key={l.staff_id} className="hover:bg-surface-raised/50 transition-colors">
                  <td className="px-3 py-2">
                    <p className="text-sm text-text-primary">{l.staff_name}</p>
                    <p className="mt-0.5 text-[10px] text-text-tertiary">
                      {l.employee_id ?? ''} {l.ssnit_number ? ` · SSNIT ${l.ssnit_number}` : ''}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums currency-amount text-text-primary">{formatGHS(l.basic_salary)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums currency-amount text-text-secondary">{l.allowances > 0 ? formatGHS(l.allowances) : '—'}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums currency-amount font-medium text-text-primary">{formatGHS(l.gross_pay)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums currency-amount text-danger">{l.ssnit_employee > 0 ? formatGHS(l.ssnit_employee) : '—'}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums currency-amount text-danger">{l.paye_tax > 0 ? formatGHS(l.paye_tax) : '—'}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums currency-amount text-text-secondary">{l.other_deductions > 0 ? formatGHS(l.other_deductions) : '—'}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums currency-amount font-semibold text-success">{formatGHS(l.net_salary)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums currency-amount text-text-secondary">{l.ssnit_employer > 0 ? formatGHS(l.ssnit_employer) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface-raised">
                <td className="px-3 py-3 text-sm font-semibold text-text-primary">Totals</td>
                <td className="px-3 py-3 text-right text-sm font-bold tabular-nums currency-amount text-text-primary">{formatGHS(r.totals.basic)}</td>
                <td className="px-3 py-3 text-right text-sm font-bold tabular-nums currency-amount text-text-secondary">{formatGHS(r.totals.allowances)}</td>
                <td className="px-3 py-3 text-right text-sm font-bold tabular-nums currency-amount text-text-primary">{formatGHS(r.totals.gross)}</td>
                <td className="px-3 py-3 text-right text-sm font-bold tabular-nums currency-amount text-danger">{formatGHS(r.totals.ssnit_employee)}</td>
                <td className="px-3 py-3 text-right text-sm font-bold tabular-nums currency-amount text-danger">{formatGHS(r.totals.paye_tax)}</td>
                <td className="px-3 py-3 text-right text-sm font-bold tabular-nums currency-amount text-text-secondary">{formatGHS(r.totals.other_deductions)}</td>
                <td className="px-3 py-3 text-right text-sm font-bold tabular-nums currency-amount text-success">{formatGHS(r.totals.net)}</td>
                <td className="px-3 py-3 text-right text-sm font-bold tabular-nums currency-amount text-text-secondary">{formatGHS(r.totals.ssnit_employer)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface-raised px-5 py-3 text-xs text-text-secondary">
        Ghana statutory rates applied · SSNIT employee 5.5% of basic · SSNIT employer 13% of basic · PAYE per GRA 2024 bands.
        The journal entry posts automatically when this run flips to <strong className="text-text-primary">paid</strong>.
      </div>
    </div>
  )
}

function Kpi({ label, value, sublabel, tone }: { label: string; value: string; sublabel?: string; tone?: 'primary' | 'success' | 'danger' }) {
  const color = tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : tone === 'primary' ? 'text-brand' : 'text-text-primary'
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={`mt-2 text-xl font-bold currency-amount ${color}`}>{value}</p>
      {sublabel && <p className="mt-1 text-[11px] text-text-tertiary">{sublabel}</p>}
    </div>
  )
}
