import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { MatchingDashboard } from '@/components/bookings/matching-dashboard'

export const metadata: Metadata = { title: 'Roommate Matching' }

export default async function RoommateMatchingPage() {
  const tenantId = await getServerTenantId()
  if (!tenantId) {
    redirect('/login')
  }

  const headersList = await headers()
  const tenantRole = headersList.get('x-tenant-role') ?? 'staff'
  if (!['owner', 'manager', 'receptionist'].includes(tenantRole)) {
    redirect('/dashboard')
  }

  const supabase = createAdminClient()

  // Fetch rooms with categories
  const { data: roomsData } = await supabase
    .from('rooms')
    .select(`
      id, room_number, block, floor, status,
      category:room_categories(id, name, type, capacity, base_rate, rate_unit)
    `)
    .eq('tenant_id', tenantId)
    .order('room_number')

  // Fetch active bookings (pending_payment, confirmed, checked_in)
  const { data: bookingsData } = await supabase
    .from('bookings')
    .select(`
      id, status, check_in_date, check_out_date,
      occupant_id, room_id, booking_ref,
      occupant:occupants(id, first_name, last_name, other_names, phone, email, student_id, institution)
    `)
    .eq('tenant_id', tenantId)
    .in('status', ['pending_payment', 'confirmed', 'checked_in'])

  // Fetch occupant matching profiles
  const { data: profilesData } = await supabase
    .from('occupant_matching_profiles')
    .select('*')
    .eq('tenant_id', tenantId)

  // Fetch tenant roommate matching status
  const { data: tenant } = await supabase
    .from('tenants')
    .select('roommate_matching_enabled')
    .eq('id', tenantId)
    .single()

  const rooms = roomsData ?? []
  const bookings = bookingsData ?? []
  const profiles = profilesData ?? []
  const matchingEnabled = tenant?.roommate_matching_enabled ?? false

  return (
    <MatchingDashboard
      rooms={rooms}
      bookings={bookings}
      profiles={profiles}
      matchingEnabled={matchingEnabled}
    />
  )
}
