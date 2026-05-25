import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { MatchingDashboard } from '@/components/bookings/matching-dashboard'

export const metadata: Metadata = { title: 'Roommate Matching' }

const ALLOWED_ROLES = ['owner', 'manager', 'receptionist'] as const

export default async function RoommateMatchingPage() {
  const tenantId = await getServerTenantId()
  if (!tenantId) {
    redirect('/login')
  }

  const supabase = createAdminClient()

  // Resolve caller's tenant_members.role. The middleware *usually* injects
  // x-tenant-role, but on edge paths (stale JWT claim + transient DB miss)
  // the header can be absent for legit owners — the page then bounced to
  // /dashboard even though the sidebar (which falls back to x-portal-role)
  // still showed the link. Fall back to a live tenant_members lookup so
  // the gate is bulletproof regardless of header state.
  const headersList = await headers()
  let tenantRole = headersList.get('x-tenant-role') ?? ''

  if (!tenantRole) {
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) redirect('/login')

    const { data: member } = await supabase
      .from('tenant_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .maybeSingle()

    tenantRole = (member as any)?.role ?? ''
  }

  if (!ALLOWED_ROLES.includes(tenantRole as (typeof ALLOWED_ROLES)[number])) {
    redirect('/dashboard')
  }

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
