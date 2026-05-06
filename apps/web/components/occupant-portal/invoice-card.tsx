import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface RoomLite { room_number: string | null; block: string | null }

interface Props {
  id:             string
  invoiceNumber:  string | null
  bookingRef:     string
  status:         string
  finalAmount:    number   // pesewas
  paidAmount:     number   // pesewas
  checkInDate:    string | null
  checkOutDate:   string | null
  room:           RoomLite | null
  color:          string
}

const STATUS = {
  paid:      { label: 'Paid',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  partial:   { label: 'Partial',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  unpaid:    { label: 'Unpaid',    cls: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
} as const

function ghs(pesewas: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(pesewas / 100)
}

function date(d: string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d))
}

function deriveStatus(status: string, final: number, paid: number): keyof typeof STATUS {
  if (status === 'cancelled')  return 'cancelled'
  if (paid >= final)           return 'paid'
  if (paid > 0)                return 'partial'
  return 'unpaid'
}

export function InvoiceCard({
  id, invoiceNumber, bookingRef, status, finalAmount, paidAmount,
  checkInDate, checkOutDate, room, color,
}: Props) {
  const key  = deriveStatus(status, finalAmount, paidAmount)
  const pill = STATUS[key]
  const heading = invoiceNumber ?? bookingRef

  return (
    <Link
      href={`/occupant-portal/invoices/${id}`}
      className="block overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-slate-900">{heading}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Room {room?.room_number ?? '—'}{room?.block ? ` · ${room.block}` : ''} · {bookingRef}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${pill.cls}`}>
          {pill.label}
        </span>
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        {date(checkInDate)} — {date(checkOutDate)}
      </p>

      <div className="mt-3 flex items-end justify-between border-t border-slate-100 pt-3">
        <span className="text-base font-bold text-slate-900">{ghs(finalAmount)}</span>
        <span className="flex items-center gap-1 text-xs font-medium" style={{ color }}>
          View <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  )
}
