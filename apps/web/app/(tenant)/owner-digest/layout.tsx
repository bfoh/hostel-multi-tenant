import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { resolveMobileContextForTenant } from '@/lib/auth/mobile-context'

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
  const tenantId = h.get('x-tenant-id')

  const ctx = await resolveMobileContextForTenant(user.id, tenantId)

  if (ctx.role !== 'owner') {
    // Not an owner here. If the user is an occupant, send them to their portal.
    redirect(ctx.role === 'occupant' ? '/occupant-portal' : '/login')
  }

  return <>{children}</>
}
