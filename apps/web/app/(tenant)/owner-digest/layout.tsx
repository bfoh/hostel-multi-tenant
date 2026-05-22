import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Role gate for the mobile owner-digest screens.
 * Allows `tenant_members.role = 'owner'` only (strict per spec — mobile
 * owner experience is "ONLY the daily digest"). All other roles bounce
 * to the occupant portal or login.
 */
export default async function OwnerDigestLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const h = await headers()
  let tenantId = h.get('x-tenant-id')

  const admin = createAdminClient() as any

  // Find a tenant_members row where this user is an owner. We do not require
  // x-tenant-id (some entry paths arrive without it on cold mobile launch).
  let query = admin
    .from('tenant_members')
    .select('tenant_id, role, is_active')
    .eq('user_id', user.id)
    .eq('role', 'owner')
    .eq('is_active', true)

  if (tenantId) query = query.eq('tenant_id', tenantId)

  const { data: member } = await query.maybeSingle()

  if (!member) {
    // Not an owner here. If the user is an occupant, send them to their portal.
    const { data: occ } = await admin
      .from('occupants')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    redirect(occ ? '/occupant-portal' : '/login')
  }

  return <>{children}</>
}
