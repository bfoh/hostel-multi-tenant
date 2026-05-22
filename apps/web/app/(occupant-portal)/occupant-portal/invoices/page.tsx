import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { FileText } from 'lucide-react'

import { getOccupantSession } from '@/lib/auth/occupant-session'
import { getOccupantInvoices } from '@/lib/data/occupant-invoices'
import { InvoiceCard } from '@/components/occupant-portal/invoice-card'

export const metadata: Metadata = { title: 'Invoices · My Portal' }

export default async function OccupantInvoicesPage() {
  const session = await getOccupantSession()
  if (!session) redirect('/login')

  const invoices = await getOccupantInvoices(session.occupantId, session.tenantId)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${session.tenantColor}14` }}
        >
          <FileText className="h-5 w-5" style={{ color: session.tenantColor }} strokeWidth={2.1} />
        </span>
        <div>
          <h1 className="text-[18px] font-bold tracking-tight text-slate-900">Invoices</h1>
          <p className="text-[12px] text-slate-500">Tax-compliant receipts for your bookings</p>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-slate-200/70 bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_28px_-18px_rgba(16,24,40,0.20)]">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-100">
            <FileText className="h-7 w-7 text-slate-300" />
          </span>
          <p className="mt-3 text-[14px] font-semibold text-slate-700">No invoices yet</p>
          <p className="mt-0.5 text-[12.5px] text-slate-400">Invoices appear here once you have a booking.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv: any) => {
            const room = Array.isArray(inv.room) ? inv.room[0] : inv.room
            return (
              <InvoiceCard
                key={inv.id}
                id={inv.id}
                invoiceNumber={inv.invoice_number ?? null}
                bookingRef={inv.booking_ref}
                status={inv.status}
                finalAmount={inv.final_amount}
                paidAmount={inv.paid_amount}
                checkInDate={inv.check_in_date ?? null}
                checkOutDate={inv.check_out_date ?? null}
                room={room ? { room_number: room.room_number, block: room.block } : null}
                color={session.tenantColor}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
