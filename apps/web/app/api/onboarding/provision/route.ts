import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/onboarding/provision
 * Called by new users (no tenant yet) to create their hostel tenant record.
 * Uses service role to insert into tenants + tenant_members (RLS would block this).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const admin = createAdminClient()

  // Idempotent — if user already has a tenant, return it
  const { data: existing } = await admin
    .from('tenant_members')
    .select('tenant_id, tenants(id, slug, name, onboarding_completed)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (existing?.tenant_id) {
    const t = Array.isArray(existing.tenants) ? existing.tenants[0] : existing.tenants
    return NextResponse.json({ tenantId: existing.tenant_id, slug: (t as any)?.slug, alreadyExists: true })
  }

  // Derive hostel name from signup metadata or email
  const rawName: string = (user.user_metadata?.hostel_name as string) || ''
  const hostelName = rawName.trim() || 'My Hostel'

  // Generate a unique slug from the hostel name
  const baseSlug = hostelName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'hostel'

  // Ensure slug uniqueness
  let slug = baseSlug
  let attempt = 0
  while (true) {
    const { data: taken } = await admin
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (!taken) break
    attempt++
    slug = `${baseSlug}-${attempt}`
  }

  // Create the tenant
  const { data: tenant, error: tenantErr } = await admin
    .from('tenants')
    .insert({
      name:   hostelName,
      slug,
      status: 'trial',
      onboarding_completed: false,
      enquiry_webhook_secret: crypto.randomUUID(),
    })
    .select('id, slug')
    .single()

  if (tenantErr || !tenant) {
    return NextResponse.json({ error: tenantErr?.message ?? 'Failed to create tenant' }, { status: 500 })
  }

  // Add user as owner
  const { error: memberErr } = await admin
    .from('tenant_members')
    .insert({
      tenant_id: tenant.id,
      user_id:   user.id,
      role:      'owner',
      is_active: true,
      joined_at: new Date().toISOString(),
    })

  if (memberErr) {
    // Clean up orphaned tenant
    await admin.from('tenants').delete().eq('id', tenant.id)
    return NextResponse.json({ error: memberErr.message }, { status: 500 })
  }

  return NextResponse.json({ tenantId: tenant.id, slug: tenant.slug, alreadyExists: false }, { status: 201 })
}
