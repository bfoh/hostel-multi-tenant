import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Returns the authenticated user if they're a platform super-admin
 * (has a row in platform_admins), else null. Shared by every
 * /api/admin/* route that needs this gate — was previously copy-pasted
 * identically across them.
 */
export async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: pa } = await admin
    .from('platform_admins')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  return pa ? user : null
}
