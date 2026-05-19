import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { ChevronLeft, Download, Printer } from 'lucide-react'

import { getInvoiceById } from '@/lib/data/invoices'
import { splitGhanaTax } from '@/lib/tax/ghana'
import { formatDate } from '@/lib/utils'
import { PrintButton } from '@/components/invoices/print-button'
import { InvoicePayLinkActions } from '@/components/invoices/pay-link-actions'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = { title: 'Invoice' }

// Match the PDF: "GHS 8,000.00" (ISO 4217 code, no cedi glyph).
function ghs(pesewas: number): string {
  return `GHS ${(pesewas / 100).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

const METHOD_LABEL: Record<string, string> = {
  momo_mtn:        'MTN Mobile Money',
  momo_vodafone:   'Telecel Cash',
  momo_airteltigo: 'AirtelTigo Money',
  cash:            'Cash',
  bank_transfer:   'Bank Transfer',
  card:            'Card',
  cheque:          'Cheque',
}

function methodLabel(raw: string | null | undefined): string {
  if (!raw) return 'Payment'
  return METHOD_LABEL[raw] ?? raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const PAYMENT_BADGE: Record<string, string> = {
  unpaid:  'bg-danger-subtle text-danger border-danger/20',
  partial: 'bg-warning-subtle text-warning-fg border-warning/20',
  paid:    'bg-success-subtle text-success border-success/20',
}

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id }       = await params
  const inv          = await getInvoiceById(id) as any
  if (!inv) notFound()

  const headersList  = await headers()
  const tenantId     = headersList.get('x-tenant-id') ?? ''
  const tenantName   = headersList.get('x-tenant-name') ?? 'Your Hostel'

  // Fetch GRA fields from tenant
  const supabase = createAdminClient()
  const { data: tenantRaw } = await supabase
    .from('tenants')
    .select('name, tagline, address_line1, address_city, contact_phone, contact_email, logo_url, tin, vat_reg_number, is_vat_registered, paystack_subaccount_code')
    .eq('id', tenantId)
    .single()
  const tenant = tenantRaw as any
  const paystackReady = !!process.env.PAYSTACK_SECRET_KEY && !!tenant?.paystack_subaccount_code

  const occupant = Array.isArray(inv.occupant) ? inv.occupant[0] : inv.occupant
  const room     = Array.isArray(inv.room)     ? inv.room[0]     : inv.room
  const cat      = Array.isArray(room?.category) ? room?.category[0] : room?.category
  // booking_payments.status enum: 'pending' | 'success' | 'failed' | 'reversed'
  const payments = (inv.booking_payments ?? []).filter((p: any) => p.status === 'success')
  const balance  = Math.max(0, inv.final_amount - inv.paid_amount)

  // Tax breakdown — prefer stored itemised fields; fall back to splitting combined tax_amount
  const hasItemisedTax = (inv as any).vat_amount > 0 || (inv as any).nhil_amount > 0
  const vatAmt     = hasItemisedTax ? (inv as any).vat_amount     : splitGhanaTax(inv.tax_amount).vat
  const nhilAmt    = hasItemisedTax ? (inv as any).nhil_amount    : splitGhanaTax(inv.tax_amount).nhil
  const getfundAmt = hasItemisedTax ? (inv as any).getfund_amount : splitGhanaTax(inv.tax_amount).getfund

  const invoiceNumber = (inv as any).invoice_number ?? inv.booking_ref
  const isVatReg      = tenant?.is_vat_registered ?? false

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
          <InvoicePayLinkActions
            bookingId={inv.id}
            balance={balance}
            occupantEmail={occupant?.email ?? null}
            occupantPhone={occupant?.phone ?? null}
            paystackEnabled={paystackReady}
          />
          <Link
            href={`/bookings/${inv.id}`}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-raised transition-colors"
          >
            View booking
          </Link>
          <PrintButton />
          <a
            href={`/api/invoices/${id}/pdf`}
            download
            className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </a>
        </div>
      </div>

      {/* Invoice card */}
      <div className="rounded-xl border border-border bg-white p-8 shadow-sm print:shadow-none print:border-none print:p-0 print:rounded-none">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 pb-6">
          <div className="flex items-start gap-4">
            {tenant?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenant.logo_url}
                alt=""
                className="h-14 w-14 shrink-0 rounded-full object-contain bg-white"
              />
            ) : (
              <div className="h-14 w-14 shrink-0 rounded-lg bg-[#1B4F72] flex items-center justify-center text-white text-xl font-bold">
                {(tenant?.name ?? tenantName).charAt(0)}
              </div>
            )}
            <div>
              <p className="text-2xl font-bold text-[#1B4F72]">{tenant?.name ?? tenantName}</p>
              {tenant?.tagline    && <p className="text-sm text-gray-500 mt-0.5">{tenant.tagline}</p>}
              {tenant?.address_line1 && (
                <p className="text-sm text-gray-500 mt-1">
                  {[tenant.address_line1, tenant.address_city].filter(Boolean).join(', ')}
                </p>
              )}
              {tenant?.contact_phone && <p className="text-sm text-gray-500">{tenant.contact_phone}</p>}
              {tenant?.contact_email && <p className="text-sm text-gray-500">{tenant.contact_email}</p>}
              {tenant?.tin && (
                <p className="text-xs text-gray-400 mt-1">TIN: {tenant.tin}</p>
              )}
              {isVatReg && tenant?.vat_reg_number && (
                <p className="text-xs text-gray-400">VAT Reg: {tenant.vat_reg_number}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">
              {isVatReg ? 'VAT Invoice' : 'Invoice'}
            </p>
            <p className="font-mono text-sm font-bold text-gray-900 mt-1">{invoiceNumber}</p>
            <p className="text-xs text-gray-500 mt-1">Issued: {formatDate(inv.created_at)}</p>
            <span className={`mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${PAYMENT_BADGE[inv.payment_status] ?? 'bg-surface-raised text-text-secondary border-border'}`}>
              {inv.payment_status}
            </span>
          </div>
        </div>

        {/* Bill to + Room details */}
        <div className="mt-6 grid grid-cols-2 gap-8">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Bill To</p>
            <p className="font-semibold text-gray-900">
              {occupant?.first_name} {occupant?.last_name}
              {occupant?.other_names ? ` ${occupant.other_names}` : ''}
            </p>
            {occupant?.student_id  && <p className="text-sm text-gray-500">ID: {occupant.student_id}</p>}
            {occupant?.institution && <p className="text-sm text-gray-500">{occupant.institution}</p>}
            {occupant?.programme   && <p className="text-sm text-gray-500">{occupant.programme}</p>}
            {occupant?.phone       && <p className="text-sm text-gray-500 mt-1">{occupant.phone}</p>}
            {occupant?.email       && <p className="text-sm text-gray-500">{occupant.email}</p>}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Room Details</p>
            <p className="font-semibold text-gray-900">
              Room {room?.room_number}
              {room?.block ? ` — Block ${room.block}` : ''}
              {room?.floor != null ? `, Floor ${room.floor}` : ''}
            </p>
            {cat && <p className="text-sm text-gray-500">{(cat as any).name}</p>}
            <p className="text-sm text-gray-500 mt-1">Check-in: {formatDate(inv.check_in_date)}</p>
            <p className="text-sm text-gray-500">Check-out: {formatDate(inv.check_out_date)}</p>
            {inv.semester && <p className="text-sm text-gray-500">Semester: {inv.semester}</p>}
          </div>
        </div>

        {/* Line items */}
        <div className="mt-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400">Description</th>
                <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400 w-36">Amount (GHS)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* Accommodation */}
              <tr>
                <td className="py-3 text-gray-900">
                  Room accommodation — {(cat as any)?.name ?? 'Standard'}
                  <span className="ml-2 text-xs text-gray-400">
                    ({formatDate(inv.check_in_date)} → {formatDate(inv.check_out_date)})
                  </span>
                </td>
                <td className="py-3 text-right font-mono">{ghs(inv.total_amount)}</td>
              </tr>

              {/* Discount */}
              {inv.discount_amount > 0 && (
                <tr>
                  <td className="py-3 text-gray-500">
                    Discount{inv.discount_reason ? ` — ${inv.discount_reason}` : ''}
                  </td>
                  <td className="py-3 text-right font-mono text-green-700">−{ghs(inv.discount_amount)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Tax breakdown */}
        {inv.tax_amount > 0 && (
          <div className="mt-4 ml-auto w-72 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal (excl. taxes)</span>
              <span className="font-mono">{ghs(inv.total_amount - inv.discount_amount)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>VAT (15%)</span>
              <span className="font-mono">{ghs(vatAmt)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>NHIL (2.5%)</span>
              <span className="font-mono">{ghs(nhilAmt)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>GETFund (2.5%)</span>
              <span className="font-mono">{ghs(getfundAmt)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-1.5 font-semibold text-gray-900">
              <span>Total</span>
              <span className="font-mono">{ghs(inv.final_amount)}</span>
            </div>
          </div>
        )}

        {/* No-tax totals block */}
        {inv.tax_amount === 0 && (
          <div className="mt-4 flex justify-end">
            <table className="text-sm w-64">
              <tbody>
                {inv.discount_amount > 0 && (
                  <tr>
                    <td className="pr-8 text-gray-500">Subtotal</td>
                    <td className="text-right font-mono">{ghs(inv.total_amount)}</td>
                  </tr>
                )}
                <tr className="border-t border-gray-300">
                  <td className="pr-8 pt-2 font-bold text-gray-900 text-base">Total</td>
                  <td className="pt-2 text-right font-mono font-bold text-base">{ghs(inv.final_amount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Paid / Balance */}
        <div className="mt-3 flex justify-end">
          <table className="text-sm w-64">
            <tbody>
              <tr>
                <td className="pr-8 text-green-700">Amount paid</td>
                <td className="text-right font-mono text-green-700">{ghs(inv.paid_amount)}</td>
              </tr>
              {balance > 0 && (
                <tr>
                  <td className="pr-8 font-semibold text-red-600">Balance due</td>
                  <td className="text-right font-mono font-bold text-red-600">{ghs(balance)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Payment history */}
        {payments.length > 0 && (
          <div className="mt-8 border-t border-gray-200 pt-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Payment History</p>
            <div className="space-y-2">
              {payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400">{p.paid_at ? formatDate(p.paid_at) : '—'}</span>
                    <span className="text-gray-700">{methodLabel(p.method)}</span>
                    {p.reference && (
                      <span className="font-mono text-xs text-gray-400">Ref: {p.reference}</span>
                    )}
                  </div>
                  <span className="font-mono font-medium text-green-700">{ghs(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GRA compliance note */}
        <div className="mt-8 border-t border-gray-100 pt-5 space-y-1 text-center text-xs text-gray-400">
          {isVatReg ? (
            <p>
              VAT/NHIL/GETFund charged at 15% / 2.5% / 2.5% respectively per GRA guidelines.
              VAT Reg. No. {tenant?.vat_reg_number} · TIN: {tenant?.tin}
            </p>
          ) : (
            <p>
              This invoice includes NHIL (2.5%) and GETFund (2.5%) levies as required by Ghana law.
              {tenant?.tin && ` TIN: ${tenant.tin}.`}
            </p>
          )}
          <p>Thank you for choosing {tenant?.name ?? tenantName}.</p>
          <p>This is a computer-generated document and does not require a signature.</p>
        </div>
      </div>
    </div>
  )
}
