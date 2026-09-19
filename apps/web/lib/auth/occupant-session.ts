/**
 * Shared utility for occupant portal server components.
 *
 * Fetches occupant + tenant context directly from the DB via user_id —
 * no reliance on x-tenant-id headers or JWT claims, which can be stale
 * on localhost or right after the first login.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export interface OccupantSession {
  userId:       string
  occupantId:   string
  tenantId:     string
  tenantName:   string
  tenantColor:  string
  firstName:    string
  lastName:     string
}

/**
 * Resolves the current occupant's session from the DB.
 * Redirects to /login if unauthenticated, or returns null if the user
 * is authenticated but has no linked occupant record.
 */
export async function getOccupantSession(): Promise<OccupantSession | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  // .single()/.maybeSingle() would throw (and, destructured here, silently
  // resolve to `data: null`) for a user with more than one occupants row —
  // a real case for a returning student re-enrolled at a different hostel
  // in a later year. Order + limit instead so this degrades to "pick the
  // most recent one" rather than treating a legitimate multi-tenant user
  // as if they had no occupant record at all.
  const { data: rows } = await admin
    .from('occupants')
    .select('id, tenant_id, first_name, last_name, tenants(name, primary_color)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  const data = rows?.[0]
  if (!data) return null

  const tenant = Array.isArray(data.tenants) ? data.tenants[0] : data.tenants as any

  return {
    userId:      user.id,
    occupantId:  data.id,
    tenantId:    data.tenant_id,
    tenantName:  tenant?.name         ?? 'Hostel',
    tenantColor: tenant?.primary_color ?? '#2563EB',
    firstName:   data.first_name,
    lastName:    data.last_name,
  }
}
