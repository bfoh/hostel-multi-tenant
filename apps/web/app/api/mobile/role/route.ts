import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/mobile/role
 * Returns the logged-in user's mobile-app role so the Capacitor shell
 * can route after webview cookies have settled.
 *
 *   { role: 'owner' | null,       // tenant_members.role = 'owner'
 *     is_occupant: boolean,       // has a row in occupants
 *     tenant_id: string | null }
 *
 * Unauthenticated callers get all-null/false (200, not 401) so the
 * shell can decide whether to nudge the webview toward /login.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ role: null, is_occupant: false, tenant_id: null })
  }

  const admin = createAdminClient() as any

  const [{ data: member }, { data: occupant }] = await Promise.all([
    admin
      .from('tenant_members')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .eq('is_active', true)
      .maybeSingle(),
    admin
      .from('occupants')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  return NextResponse.json({
    role:        member?.role        ?? null,
    is_occupant: !!occupant,
    tenant_id:   member?.tenant_id ?? occupant?.tenant_id ?? null,
  })
}
