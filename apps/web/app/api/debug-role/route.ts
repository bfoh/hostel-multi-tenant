import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/debug-role — temporary. Open while logged in. Shows JWT claims and
 * tenant_members; if there's no membership it attempts to provision the tenant
 * + owner membership (mirroring the auth callback) and reports any error —
 * both diagnosing and repairing. Delete after.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not logged in' }, { status: 401 })

  let claims: Record<string, unknown> | null = null
  const tok = session?.access_token
  if (tok) {
    try { claims = JSON.parse(Buffer.from(tok.split('.')[1], 'base64').toString('utf8')) } catch { claims = null }
  }

  const admin = createAdminClient()
  const { data: members } = await admin
    .from('tenant_members')
    .select('tenant_id, role, is_active, joined_at')
    .eq('user_id', user.id)

  const repair: Record<string, unknown> = { attempted: false }

  if (!members || members.length === 0) {
    repair.attempted = true
    const rawName: string = (user.user_metadata?.hostel_name as string) || ''
    const hostelName = rawName.trim() || 'My Hostel'
    const baseSlug = hostelName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'hostel'

    let slug = baseSlug
    let attempt = 0
    while (true) {
      const { data: taken } = await admin.from('tenants').select('id').eq('slug', slug).maybeSingle()
      if (!taken) break
      attempt++; slug = `${baseSlug}-${attempt}`
    }

    const { data: tenant, error: tenantErr } = await admin
      .from('tenants')
      .insert({ name: hostelName, slug, status: 'trial', onboarding_completed: false, enquiry_webhook_secret: crypto.randomUUID() })
      .select('id, slug')
      .single()

    repair.hostel_name = hostelName
    repair.slug = slug
    repair.tenant_error = tenantErr?.message ?? null

    if (tenant) {
      const { error: memberErr } = await admin.from('tenant_members').insert({
        tenant_id: tenant.id,
        user_id:   user.id,
        role:      'owner',
        is_active: true,
        joined_at: new Date().toISOString(),
      })
      repair.tenant_id = tenant.id
      repair.member_error = memberErr?.message ?? null
      repair.ok = !memberErr
    }
  }

  return NextResponse.json({
    user_id: user.id,
    email:   user.email,
    user_metadata: user.user_metadata,
    jwt_claims: claims ? {
      tenant_role: (claims as any).tenant_role ?? null,
      portal_role: (claims as any).portal_role ?? null,
      tenant_id:   (claims as any).tenant_id ?? null,
    } : 'no access_token',
    tenant_members: members ?? [],
    repair,
  })
}
