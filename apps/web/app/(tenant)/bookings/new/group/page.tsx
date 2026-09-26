import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId, getServerBusinessType } from '@/lib/auth/tenant'
import { getAvailableRooms } from '@/lib/data/bookings'
import { GroupBookingForm } from '@/components/bookings/group-booking-form'

export const metadata: Metadata = { title: 'New Group Booking' }
export const dynamic = 'force-dynamic'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}
function tomorrowIso() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export default async function NewGroupBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ check_in?: string; check_out?: string }>
}) {
  // Group booking is a hotel-only feature — see plan for why.
  const isHotel = (await getServerBusinessType()) === 'hotel'
  if (!isHotel) notFound()

  const { check_in, check_out } = await searchParams
  const checkIn  = check_in  ?? todayIso()
  const checkOut = check_out ?? tomorrowIso()

  const tenantId = await getServerTenantId()
  const supabase = createAdminClient()

  const [rooms, occupantsRes] = await Promise.all([
    getAvailableRooms(checkIn, checkOut),
    tenantId
      ? supabase
          .from('occupants')
          .select('id, first_name, last_name, phone, status')
          .eq('tenant_id', tenantId)
          .neq('status', 'blacklisted')
          .order('first_name')
          .limit(500)
      : Promise.resolve({ data: [] }),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <Link href="/bookings" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Bookings
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">New Group Booking</h1>
        <p className="text-sm text-text-secondary">Book multiple rooms together as one group, with a combined invoice.</p>
      </div>

      <GroupBookingForm
        rooms={rooms as any}
        occupants={occupantsRes.data ?? []}
        checkIn={checkIn}
        checkOut={checkOut}
      />
    </div>
  )
}
