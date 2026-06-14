import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/debug-role — temporary. Open while logged in. Shows the JWT claims
 * the app actually receives (tenant_role/portal_role) and the user's
 * tenant_members rows, to diagnose why an owner is treated as staff.
 * Delete after.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not logged in' }, { status: 401 })

  // Decode the access-token payload (no verification — diagnostic only).
  let claims: Record<string, unknown> | null = null
  const tok = session?.access_token
  if (tok) {
    try {
      const payload = tok.split('.')[1]
      claims = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))
    } catch { claims = null }
  }

  const admin = createAdminClient()
  const { data: members } = await admin
    .from('tenant_members')
    .select('tenant_id, role, is_active, joined_at')
    .eq('user_id', user.id)

  return NextResponse.json({
    user_id: user.id,
    email:   user.email,
    jwt_claims: claims
      ? {
          tenant_role: (claims as any).tenant_role ?? null,
          portal_role: (claims as any).portal_role ?? null,
          tenant_id:   (claims as any).tenant_id ?? null,
          tenant_slug: (claims as any).tenant_slug ?? null,
        }
      : 'no access_token',
    tenant_members: members ?? [],
  })
}
