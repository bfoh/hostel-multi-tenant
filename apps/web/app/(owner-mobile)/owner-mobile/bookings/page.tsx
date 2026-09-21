import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BedDouble } from 'lucide-react'
import { getBookings } from '@/lib/data/bookings'
import { BookingList } from '@/components/mobile-portal/booking-list'

export const metadata: Metadata = { title: 'Bookings · Owner' }
export const dynamic = 'force-dynamic'

export default async function OwnerMobileBookingsPage() {
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

      <BookingList bookings={bookings} />
    </div>
  )
}
