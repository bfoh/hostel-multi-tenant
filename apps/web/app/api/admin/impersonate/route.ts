import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireSuperAdmin() {
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

/**
 * POST /api/admin/impersonate
 * Sets a short-lived cookie that overrides the tenant context in middleware
 * so the super-admin can browse a tenant's app as if they were a member.
 */
export async function POST(req: NextRequest) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { tenantId, tenantSlug } = await req.json()
  if (!tenantId || !tenantSlug) {
    return NextResponse.json({ error: 'tenantId and tenantSlug required' }, { status: 400 })
  }

  const response = NextResponse.json({ ok: true })

  // Short-lived cookie — 4 hours, httpOnly, sameSite strict
  const expires = new Date(Date.now() + 4 * 60 * 60 * 1000)
  response.cookies.set('x-admin-impersonate-tenant', tenantId, {
    httpOnly: true,
    sameSite: 'strict',
    expires,
    path: '/',
  })
  response.cookies.set('x-admin-impersonate-slug', tenantSlug, {
    httpOnly: true,
    sameSite: 'strict',
    expires,
    path: '/',
  })

  return response
}

/**
 * DELETE /api/admin/impersonate
 * Clears the impersonation cookies.
 */
export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('x-admin-impersonate-tenant')
  response.cookies.delete('x-admin-impersonate-slug')
  return response
}
