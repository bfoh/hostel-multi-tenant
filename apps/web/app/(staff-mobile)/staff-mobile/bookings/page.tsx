import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BedDouble, CalendarRange } from 'lucide-react'
import { getBookings } from '@/lib/data/bookings'

export const metadata: Metadata = { title: 'Bookings · Staff' }
export const dynamic = 'force-dynamic'

const STATUS_CLS: Record<string, string> = {
  enquiry:          'bg-slate-50 text-slate-500',
  pending_payment:  'bg-amber-50 text-amber-700',
  confirmed:        'bg-blue-50 text-blue-700',
  checked_in:       'bg-emerald-50 text-emerald-700',
  checked_out:      'bg-slate-100 text-slate-500',
  cancelled:        'bg-red-50 text-red-600',
  no_show:          'bg-red-50 text-red-600',
}

function money(pesewas: number | null | undefined) {
  return `GH₵ ${(((pesewas ?? 0)) / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

export default async function StaffMobileBookingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const h        = await headers()
  const tenantId = h.get('x-tenant-id')
  const color    = h.get('x-tenant-color') ?? '#2F7D57'
  if (!tenantId) redirect('/login')

  const bookings = (await getBookings()) as any[]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Bookings</h1>
          <p className="mt-0.5 text-xs text-slate-500">{bookings.length} most recent reservations</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}18` }}>
          <BedDouble className="h-4.5 w-4.5" style={{ color }} />
        </div>
      </div>

      {bookings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <CalendarRange className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">No bookings yet</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {bookings.map((b) => {
            const occ  = Array.isArray(b.occupant) ? b.occupant[0] : b.occupant
            const room = Array.isArray(b.room) ? b.room[0] : b.room
            const category = Array.isArray(room?.category) ? room?.category[0] : room?.category
            return (
              <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {occ ? [occ.first_name, occ.last_name].filter(Boolean).join(' ') : 'Guest'}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {room ? `Room ${room.room_number}${room.block ? ` · ${room.block}` : ''}` : 'Unassigned room'}
                      {category?.name ? ` · ${category.name}` : ''}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-slate-400">{b.booking_ref}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_CLS[b.status] ?? 'bg-slate-50 text-slate-500'}`}>
                    {String(b.status ?? '').replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                  <p className="text-xs text-slate-500">
                    {b.check_in_date} → {b.check_out_date}
                  </p>
                  <p className="text-sm font-semibold text-slate-800">
                    {money(b.paid_amount)} <span className="font-normal text-slate-400">/ {money(b.final_amount)}</span>
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
