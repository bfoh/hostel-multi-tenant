import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { ChevronLeft, Download } from 'lucide-react'
import { getInvoiceById } from '@/lib/data/invoices'
import { formatGHS, formatDate } from '@/lib/utils'
import { PrintButton } from '@/components/invoices/print-button'

export const metadata: Metadata = { title: 'Invoice' }

const METHOD_LABEL: Record<string, string> = {
  momo_mtn:       'MTN MoMo',
  momo_vodafone:  'Vodafone Cash',
  momo_airteltigo:'AirtelTigo Money',
  cash:           'Cash',
  bank_transfer:  'Bank Transfer',
  card:           'Card',
  cheque:         'Cheque',
}

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const inv = await getInvoiceById(id)
  if (!inv) notFound()

  const headersList = await headers()
  const tenantName  = headersList.get('x-tenant-name') ?? 'Your Hostel'

  const occupant = Array.isArray(inv.occupant) ? inv.occupant[0] : inv.occupant
  const room     = Array.isArray(inv.room)     ? inv.room[0]     : inv.room
  const cat      = Array.isArray(room?.category) ? room?.category[0] : room?.category
  const payments = inv.booking_payments ?? []
  const balance  = Math.max(0, inv.final_amount - inv.paid_amount)

  const PAYMENT_BADGE: Record<string, string> = {
    unpaid:  'bg-danger-subtle text-danger border-danger/20',
    partial: 'bg-warning-subtle text-warning-fg border-warning/20',
    paid:    'bg-success-subtle text-success border-success/20',
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Nav */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/invoices"
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Invoices
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/bookings/${inv.id}`}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-raised transition-colors"
          >
            View booking
          </Link>
          <a
            href={`/api/invoices/${id}/pdf`}
            download
            className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </a>
          <PrintButton />
        </div>
      </div>

      {/* Invoice card — print-friendly */}
      <div className="rounded-xl border border-border bg-white p-8 shadow-sm print:shadow-none print:border-none">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-border pb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{tenantName}</h1>
            <p className="mt-0.5 text-sm text-text-secondary">Official Receipt / Invoice</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-text-tertiary uppercase tracking-wide">Invoice</p>
            <p className="font-mono text-sm font-semibold text-text-primary">{inv.booking_ref}</p>
            <p className="mt-1 text-xs text-text-secondary">Issued: {formatDate(inv.created_at)}</p>
            <div className="mt-2">
              <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${PAYMENT_BADGE[inv.payment_status] ?? 'bg-surface-sunken text-text-secondary border-border'}`}>
                {inv.payment_status}
              </span>
            </div>
          </div>
        </div>

        {/* Bill to + Room details */}
        <div className="mt-6 grid grid-cols-2 gap-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-2">Bill To</p>
            <p className="font-semibold text-text-primary">
              {occupant?.first_name} {occupant?.last_name}
              {occupant?.other_names ? ` ${occupant.other_names}` : ''}
            </p>
            {occupant?.student_id && (
              <p className="text-sm text-text-secondary">ID: {occupant.student_id}</p>
            )}
            {occupant?.institution && (
              <p className="text-sm text-text-secondary">{occupant.institution}</p>
            )}
            {occupant?.programme && (
              <p className="text-sm text-text-secondary">{occupant.programme}</p>
            )}
            {occupant?.phone && (
              <p className="text-sm text-text-secondary mt-1">{occupant.phone}</p>
            )}
            {occupant?.email && (
              <p className="text-sm text-text-secondary">{occupant.email}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-2">Room Details</p>
            <p className="font-semibold text-text-primary">
              Room {room?.room_number}
              {room?.block ? ` — Block ${room.block}` : ''}
              {room?.floor != null ? `, Floor ${room.floor}` : ''}
            </p>
            {cat && <p className="text-sm text-text-secondary">{cat.name}</p>}
            <p className="text-sm text-text-secondary mt-1">
              Check-in: {formatDate(inv.check_in_date)}
            </p>
            <p className="text-sm text-text-secondary">
              Check-out: {formatDate(inv.check_out_date)}
            </p>
            {inv.semester && (
              <p className="text-sm text-text-secondary">Semester: {inv.semester}</p>
            )}
          </div>
        </div>

        {/* Line items */}
        <div className="mt-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Description</th>
                <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <tr>
                <td className="py-3 text-text-primary">
                  Room accommodation — {cat?.name ?? 'Standard'}
                  <span className="ml-2 text-xs text-text-secondary">
                    ({formatDate(inv.check_in_date)} → {formatDate(inv.check_out_date)})
                  </span>
                </td>
                <td className="py-3 text-right font-mono">{formatGHS(inv.total_amount)}</td>
              </tr>
              {inv.discount_amount > 0 && (
                <tr>
                  <td className="py-3 text-text-secondary">
                    Discount
                    {inv.discount_reason ? ` — ${inv.discount_reason}` : ''}
                  </td>
                  <td className="py-3 text-right font-mono text-success">−{formatGHS(inv.discount_amount)}</td>
                </tr>
              )}
              {inv.tax_amount > 0 && (
                <tr>
                  <td className="py-3 text-text-secondary">Tax (VAT/NHIL/GETFund)</td>
                  <td className="py-3 text-right font-mono">{formatGHS(inv.tax_amount)}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border">
                <td className="pt-3 font-bold text-text-primary">Total</td>
                <td className="pt-3 text-right font-mono font-bold text-text-primary text-base">{formatGHS(inv.final_amount)}</td>
              </tr>
              <tr>
                <td className="pt-1 text-text-secondary">Amount paid</td>
                <td className="pt-1 text-right font-mono text-success">{formatGHS(inv.paid_amount)}</td>
              </tr>
              {balance > 0 && (
                <tr>
                  <td className="pt-1 font-semibold text-danger">Balance due</td>
                  <td className="pt-1 text-right font-mono font-bold text-danger">{formatGHS(balance)}</td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>

        {/* Payment history */}
        {payments.length > 0 && (
          <div className="mt-8 border-t border-border pt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-3">Payment History</p>
            <div className="space-y-2">
              {payments
                .filter((p) => p.status === 'success')
                .map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-text-secondary">{p.paid_at ? formatDate(p.paid_at) : '—'}</span>
                      <span className="text-text-primary">{METHOD_LABEL[p.method] ?? p.method}</span>
                      {p.reference && (
                        <span className="font-mono text-xs text-text-tertiary">Ref: {p.reference}</span>
                      )}
                    </div>
                    <span className="font-mono font-medium text-success">{formatGHS(p.amount)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 border-t border-border pt-4 text-center text-xs text-text-tertiary">
          <p>Thank you for choosing {tenantName}.</p>
          <p className="mt-0.5">This is a computer-generated invoice and does not require a signature.</p>
        </div>
      </div>
    </div>
  )
}
