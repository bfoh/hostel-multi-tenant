import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, Phone, Mail } from 'lucide-react'
import { notFound } from 'next/navigation'

import { getCustomerStatement } from '@/lib/data/customer-statement'
import { formatGHS } from '@/lib/utils'
import { ExportCsvButton } from '@/components/accounting/export-csv-button'
import { SendReminderButton } from '@/components/accounting/send-reminder-button'

export const metadata: Metadata = { title: 'Customer Statement' }

export default async function CustomerStatementPage({
  params,
  searchParams,
}: {
  params:       Promise<{ occupant: string }>
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { occupant: occupantId } = await params
  const sp = await searchParams

  const statement = await getCustomerStatement(occupantId, sp.from, sp.to)
  if (!statement) notFound()

  const csvRows = statement.lines.map((l) => [
    l.date, l.kind, l.reference, l.description,
    l.charge   ? (l.charge   / 100).toFixed(2) : '',
    l.payment  ? (l.payment  / 100).toFixed(2) : '',
    (l.balance / 100).toFixed(2),
  ])

  return (
    <div className="space-y-6">
      <div>
        <Link href="/accounting/ar" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Back to A/R Aging
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">
              {statement.occupant.first_name} {statement.occupant.last_name}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Statement of account · YTD through{' '}
              <strong className="text-text-primary">
                {new Date(statement.asOf).toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })}
              </strong>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
              {statement.occupant.phone && (
                <a href={`tel:${statement.occupant.phone}`} className="inline-flex items-center gap-1 hover:text-brand transition-colors">
                  <Phone className="h-3 w-3" />{statement.occupant.phone}
                </a>
              )}
              {statement.occupant.email && (
                <a href={`mailto:${statement.occupant.email}`} className="inline-flex items-center gap-1 hover:text-brand transition-colors">
                  <Mail className="h-3 w-3" />{statement.occupant.email}
                </a>
              )}
              {statement.occupant.institution && <span>{statement.occupant.institution}</span>}
              {statement.occupant.student_id && <span className="font-mono">ID {statement.occupant.student_id}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ExportCsvButton
              filename={`statement-${statement.occupant.last_name}-${statement.asOf}`}
              headers={['Date', 'Kind', 'Reference', 'Description', 'Charge (GHS)', 'Payment (GHS)', 'Balance (GHS)']}
              rows={csvRows}
            />
            {statement.closingBalance > 0 && (
              <SendReminderButton occupantId={occupantId} balance={statement.closingBalance} />
            )}
          </div>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi label="Opening balance"  value={formatGHS(statement.openingBalance)} />
        <Kpi label="Charges in period" value={formatGHS(statement.charges)}        tone="primary" />
        <Kpi label="Payments in period" value={formatGHS(statement.payments)}      tone="success" />
        <Kpi
          label="Closing balance"
          value={formatGHS(statement.closingBalance)}
          tone={statement.closingBalance > 0 ? 'danger' : 'success'}
          sublabel={statement.closingBalance > 0 ? 'Outstanding' : statement.closingBalance < 0 ? 'Credit on account' : 'Settled'}
        />
      </div>

      {/* Ledger */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        {statement.lines.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-tertiary">No activity in this period.</p>
        ) : (
          <table className="w-full min-w-[800px]">
            <thead className="bg-surface-raised">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary w-28">Date</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary w-24">Type</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary w-32">Reference</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary">Description</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-28">Charge</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-28">Payment</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-28">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              <tr className="bg-surface-raised/50">
                <td className="px-4 py-2 text-xs text-text-tertiary" colSpan={6}>Opening balance</td>
                <td className="px-4 py-2 text-right text-sm tabular-nums text-text-secondary">{formatGHS(statement.openingBalance)}</td>
              </tr>
              {statement.lines.map((l, i) => (
                <tr key={i} className="hover:bg-surface-raised/50 transition-colors">
                  <td className="px-4 py-2 text-xs text-text-secondary">
                    {new Date(l.date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      l.kind === 'invoice'
                        ? 'bg-brand/10 text-brand'
                        : 'bg-success/10 text-success'
                    }`}>
                      {l.kind}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-[11px] text-text-secondary">
                    {l.link ? <Link href={l.link} className="hover:text-brand transition-colors">{l.reference}</Link> : l.reference}
                  </td>
                  <td className="px-4 py-2 text-xs text-text-primary capitalize">{l.description}</td>
                  <td className="px-4 py-2 text-right text-sm tabular-nums currency-amount text-text-primary">
                    {l.charge > 0 ? formatGHS(l.charge) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-sm tabular-nums currency-amount text-success">
                    {l.payment > 0 ? formatGHS(l.payment) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-sm font-medium tabular-nums currency-amount text-text-primary">
                    {formatGHS(l.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface-raised">
                <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-text-primary">Closing balance</td>
                <td className="px-4 py-3 text-right text-sm font-semibold currency-amount text-text-primary">{formatGHS(statement.charges)}</td>
                <td className="px-4 py-3 text-right text-sm font-semibold currency-amount text-success">{formatGHS(statement.payments)}</td>
                <td className={`px-4 py-3 text-right text-sm font-bold tabular-nums ${statement.closingBalance > 0 ? 'text-danger' : 'text-success'}`}>
                  {formatGHS(statement.closingBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}

function Kpi({
  label, value, sublabel, tone,
}: {
  label: string
  value: string
  sublabel?: string
  tone?:    'primary' | 'success' | 'danger'
}) {
  const color = tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : tone === 'primary' ? 'text-brand' : 'text-text-primary'
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={`mt-2 text-lg font-bold currency-amount ${color}`}>{value}</p>
      {sublabel && <p className="mt-1 text-[11px] text-text-tertiary">{sublabel}</p>}
    </div>
  )
}
