import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Download } from 'lucide-react'

import { getOccupantSession } from '@/lib/auth/occupant-session'
import { getOccupantInvoiceById } from '@/lib/data/occupant-invoices'

export const metadata: Metadata = { title: 'Invoice · My Portal' }

function ghs(pesewas: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(pesewas / 100)
}

function date(d: string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d))
}

const METHOD_LABEL: Record<string, string> = {
  momo_mtn:        'MTN MoMo',
  momo_vodafone:   'Vodafone Cash',
  momo_airteltigo: 'AirtelTigo Money',
  card:            'Card',
  bank_transfer:   'Bank Transfer',
  bank_draft:      'Bank Draft',
  cash:            'Cash',
  cheque:          'Cheque',
}

export default async function OccupantInvoiceDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const session = await getOccupantSession()
  if (!session) redirect('/login')

  const { id } = await params
  const inv    = await getOccupantInvoiceById(id, session.occupantId, session.tenantId)
  if (!inv) notFound()

  const room = Array.isArray(inv.room) ? inv.room[0] : inv.room
  const cat  = room?.category ? (Array.isArray(room.category) ? room.category[0] : room.category) : null
  const occupant = Array.isArray(inv.occupant) ? inv.occupant[0] : inv.occupant

  const payments     = (inv.booking_payments ?? []).filter((p: any) => p.status === 'success')
  const subtotal     = inv.total_amount ?? inv.final_amount
  const taxAmount    = ((inv as any).vat_amount ?? 0) + ((inv as any).nhil_amount ?? 0) + ((inv as any).getfund_amount ?? 0)
  const total        = inv.final_amount
  const balance      = Math.max(0, inv.final_amount - inv.paid_amount)
  const heading      = (inv as any).invoice_number ?? inv.booking_ref
  const isCancelled  = inv.status === 'cancelled'

  return (
    <div className="space-y-4">
      <Link
        href="/occupant-portal/invoices"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to invoices
      </Link>

      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-lg font-bold text-slate-900">{heading}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Issued {date(inv.created_at)}</p>
          </div>
          {isCancelled && (
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
              Cancelled
            </span>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <Pair label="Resident" value={`${occupant?.first_name ?? ''} ${occupant?.last_name ?? ''}`.trim() || '—'} />
          <Pair label="Booking"  value={inv.booking_ref} mono />
          <Pair label="Room"     value={room?.room_number ? `${room.room_number}${room.block ? ` · ${room.block}` : ''}` : '—'} />
          <Pair label="Stay"     value={`${date(inv.check_in_date)} — ${date(inv.check_out_date)}`} />
          {cat?.name && <Pair label="Type" value={cat.name} />}
          {inv.semester && <Pair label="Semester" value={inv.semester} />}
        </dl>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Line items
        </h2>
        <div className="px-5 py-4 space-y-1.5">
          <Row label={cat?.name ? `${cat.name} accommodation` : 'Accommodation'} value={ghs(subtotal)} />
          {(inv as any).discount_amount > 0 && (
            <Row label={`Discount${(inv as any).discount_reason ? ` — ${(inv as any).discount_reason}` : ''}`} value={`-${ghs((inv as any).discount_amount)}`} />
          )}
          {(inv as any).vat_amount > 0      && <Row label="VAT (15%)"     value={ghs((inv as any).vat_amount)} />}
          {(inv as any).nhil_amount > 0     && <Row label="NHIL (2.5%)"   value={ghs((inv as any).nhil_amount)} />}
          {(inv as any).getfund_amount > 0  && <Row label="GETFund (2.5%)" value={ghs((inv as any).getfund_amount)} />}
          {taxAmount > 0 && (
            <p className="pt-1 text-right text-[10px] text-slate-400">Tax total: {ghs(taxAmount)}</p>
          )}
        </div>
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
          <Row label="Total" value={ghs(total)} bold />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Payments received
        </h2>
        {payments.length === 0 ? (
          <p className="px-5 py-6 text-center text-xs text-slate-400">No payments recorded yet.</p>
        ) : (
          <div className="px-5 py-3 divide-y divide-slate-100">
            {payments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-700">
                  ✓ {METHOD_LABEL[p.method] ?? p.method} · {date(p.paid_at)}
                </span>
                <span className="font-mono font-semibold text-slate-900">{ghs(p.amount)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 space-y-1.5">
          <Row label="Paid"    value={ghs(inv.paid_amount)} />
          <Row label="Balance" value={ghs(balance)} bold />
        </div>
      </section>

      <a
        href={`/api/occupant/invoices/${inv.id}/pdf`}
        className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white shadow-sm"
        style={{ backgroundColor: session.tenantColor }}
      >
        <Download className="h-4 w-4" /> Download PDF
      </a>
    </div>
  )
}

function Pair({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-sm ${bold ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  )
}
