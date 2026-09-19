import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveMobileContext } from '@/lib/auth/mobile-context'

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

  const ctx = await resolveMobileContext(user.id)

  return NextResponse.json({
    role:        ctx.role === 'owner' ? 'owner' : null,
    is_occupant: ctx.role === 'occupant',
    tenant_id:   ctx.tenantId,
  })
}
