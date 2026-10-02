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

  // Resolve caller's tenant_members.role from the DB directly. We used to
  // trust the x-tenant-role header set by middleware, but that header can
  // be missing OR stale (e.g. JWT carries an old role after a role change,
  // or fetchRoleForUser had a transient miss). The DB is authoritative —
  // except for a super-admin impersonation session, which has no real
  // tenant_members row for its own user_id by design; there, the header is
  // the only source of truth and middleware only ever sets it to 'owner'
  // after verifying platform_admins membership.
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/login')

  const isImpersonating = (await headers()).get('x-admin-impersonating') === 'true'

  let effectiveRole: string | null
  if (isImpersonating) {
    effectiveRole = (await headers()).get('x-tenant-role')
  } else {
    const { data: member } = await supabase
      .from('tenant_members')
      .select('role, is_active')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const dbRole   = (member as any)?.role      ?? null
    const dbActive = (member as any)?.is_active ?? null

    effectiveRole = dbActive ? dbRole : null
  }
  if (!effectiveRole || !ALLOWED_ROLES.includes(effectiveRole as (typeof ALLOWED_ROLES)[number])) {
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
