import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { BookingForm } from '@/components/bookings/booking-form'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

export const metadata: Metadata = { title: 'New Booking' }
export const dynamic = 'force-dynamic'

async function getFormData() {
  const tenantId = await getServerTenantId()
  if (!tenantId) return { rooms: [], occupants: [] }

  const supabase = createAdminClient()

  const [roomsRes, occupantsRes, activeBookingsRes] = await Promise.all([
    supabase
      .from('rooms')
      .select('id, room_number, block, floor, status, category:room_categories(id, name, type, base_rate, rate_unit, capacity)')
      .eq('tenant_id', tenantId)
      .not('status', 'in', '(maintenance,blocked)')
      .order('room_number'),
    supabase
      .from('occupants')
      .select('id, first_name, last_name, phone, student_id, institution, status')
      .eq('tenant_id', tenantId)
      .neq('status', 'blacklisted')
      .order('first_name')
      .limit(500),
    // Count all active (non-terminal) bookings per room
    supabase
      .from('bookings')
      .select('room_id')
      .eq('tenant_id', tenantId)
      .in('status', ['pending_payment', 'confirmed', 'checked_in']),
  ])

  // Build room_id → active booking count map
  const bookingCount: Record<string, number> = {}
  for (const b of activeBookingsRes.data ?? []) {
    bookingCount[b.room_id] = (bookingCount[b.room_id] ?? 0) + 1
  }

  const rooms = (roomsRes.data ?? []).map((room) => {
    const cat = Array.isArray(room.category) ? room.category[0] : room.category
    const capacity = cat?.capacity ?? 1
    const booked = bookingCount[room.id] ?? 0
    return { ...room, spotsRemaining: Math.max(0, capacity - booked) }
  }).filter((room) => room.spotsRemaining > 0)

  return {
    rooms,
    occupants: occupantsRes.data ?? [],
  }
}

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string; occupant?: string; occupant_id?: string }>
}) {
  const { room: preselectedRoom, occupant, occupant_id } = await searchParams
  const preselectedOccupant = occupant_id ?? occupant
  const { rooms, occupants } = await getFormData()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link href="/bookings" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Bookings
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">New Booking</h1>
      </div>

      <BookingForm
        rooms={rooms}
        occupants={occupants}
        preselectedRoomId={preselectedRoom}
        preselectedOccupantId={preselectedOccupant}
      />
    </div>
  )
}
