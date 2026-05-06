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
      <header className="px-1">
        <h1 className="text-xl font-bold text-slate-900">Invoices</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Tax-compliant receipts for your bookings.
        </p>
      </header>

      {invoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <FileText className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-500">No invoices yet</p>
          <p className="mt-1 text-xs text-slate-400">Invoices appear here once you have a booking.</p>
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
