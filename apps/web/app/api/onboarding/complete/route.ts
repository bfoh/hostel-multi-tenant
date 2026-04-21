import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getServerTenantId } from '@/lib/auth/tenant'
import { invalidateTenantCache } from '@/lib/tenant/resolve'

const schema = z.object({
  // Optional: wizard passes this after self-provisioning (cookie not set yet)
  tenantId:      z.string().uuid().optional(),

  // Step 1: Identity
  name:          z.string().min(2).max(120),
  slug:          z.string().min(2).max(40).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  custom_domain: z.string().max(253).regex(/^([a-z0-9-]+\.)+[a-z]{2,}$/, 'Invalid domain').optional().nullable(),
  tagline:       z.string().max(200).optional().nullable(),
  contact_phone: z.string().max(30).optional().nullable(),
  contact_email: z.string().email().optional().nullable(),
  address_city:  z.string().max(100).optional().nullable(),
  address_region:z.string().max(100).optional().nullable(),
  currency:      z.string().max(10).optional().default('GHS'),
  timezone:      z.string().max(60).optional().default('Africa/Accra'),

  // Step 2: Branding
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  logo_url:      z.string().url().optional().nullable(),

  // Step 3: Room category
  category_name: z.string().min(1).max(80),
  category_type: z.enum(['single', 'double', 'triple', 'quad', 'dormitory', 'suite', 'studio', 'shared']),
  base_rate:     z.number().int().positive(),   // pesewas
  rate_unit:     z.enum(['night', 'week', 'month', 'semester']),
  capacity:      z.number().int().min(1).max(20),

  // Step 3: First room
  room_number: z.string().min(1).max(20),
  block:       z.string().max(50).optional().nullable(),
  floor:       z.number().int().min(0).max(100).optional().nullable(),
})

export async function POST(request: NextRequest) {
  const body   = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  // Resolve tenant + user (user needed for selected_plan from metadata)
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()

  let tenantId = await getServerTenantId() ?? parsed.data.tenantId ?? null

  if (!tenantId && user) {
    const admin = createAdminClient()
    const { data: m } = await admin
      .from('tenant_members')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    tenantId = m?.tenant_id ?? null
  }

  // Carry the plan the user picked on the landing page into the tenant row.
  // Billing page autosubscribe flow consumes it.
  const rawSelected = user?.user_metadata?.selected_plan as string | undefined
  const selectedPlan =
    rawSelected && ['starter', 'growth', 'pro', 'trial'].includes(rawSelected)
      ? rawSelected
      : null

  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const supabase = createAdminClient()
  const d = parsed.data

  // Check slug uniqueness (if changed from current)
  const { data: existing } = await supabase
    .from('tenants')
    .select('slug, custom_domain')
    .eq('id', tenantId)
    .single()

  if (existing && existing.slug !== d.slug) {
    const { data: slugTaken } = await supabase
      .from('tenants').select('id').eq('slug', d.slug).neq('id', tenantId).maybeSingle()
    if (slugTaken) return NextResponse.json({ error: 'slug_taken', message: 'That URL is already taken' }, { status: 409 })
  }

  // Check custom_domain uniqueness (if set and changed)
  if (d.custom_domain && d.custom_domain !== existing?.custom_domain) {
    const { data: domainTaken } = await supabase
      .from('tenants').select('id').eq('custom_domain', d.custom_domain).neq('id', tenantId).maybeSingle()
    if (domainTaken) return NextResponse.json({ error: 'domain_taken', message: 'That domain is already registered to another hostel' }, { status: 409 })
  }

  // 1. Update tenant profile + branding
  // Cast to any: generated types lag new columns (selected_plan, trial_ends_at).
  const { error: tenantErr } = await (supabase.from('tenants') as any)
    .update({
      name:                 d.name,
      slug:                 d.slug,
      tagline:              d.tagline ?? null,
      contact_phone:        d.contact_phone ?? null,
      contact_email:        d.contact_email ?? null,
      address_city:         d.address_city ?? null,
      address_region:       d.address_region ?? null,
      currency:             d.currency ?? 'GHS',
      timezone:             d.timezone ?? 'Africa/Accra',
      primary_color:        d.primary_color ?? null,
      logo_url:             d.logo_url ?? null,
      custom_domain:        d.custom_domain ?? null,
      onboarding_completed: true,
      ...(selectedPlan ? { selected_plan: selectedPlan } : {}),
    })
    .eq('id', tenantId)

  if (tenantErr) return NextResponse.json({ error: tenantErr.message }, { status: 500 })

  // 2. Create room category
  const { data: category, error: catErr } = await (supabase.from('room_categories') as any)
    .insert({
      tenant_id:  tenantId,
      name:       d.category_name,
      type:       d.category_type,
      base_rate:  d.base_rate,
      rate_unit:  d.rate_unit,
      capacity:   d.capacity,
      amenities:  [],
      is_active:  true,
      sort_order: 1,
    })
    .select('id')
    .single()

  if (catErr) return NextResponse.json({ error: catErr.message }, { status: 500 })

  // 3. Create first room
  const { error: roomErr } = await supabase
    .from('rooms')
    .insert({
      tenant_id:           tenantId,
      category_id:         category.id,
      room_number:         d.room_number,
      block:               d.block ?? null,
      floor:               d.floor ?? null,
      status:              'available',
      housekeeping_status: 'clean',
    })

  if (roomErr) return NextResponse.json({ error: roomErr.message }, { status: 500 })

  // Bust Redis cache so branding picked during onboarding applies immediately
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'
  await invalidateTenantCache(`${d.slug}.${appDomain}`)
  if (d.custom_domain) await invalidateTenantCache(d.custom_domain)

  return NextResponse.json({ ok: true, slug: d.slug, selected_plan: selectedPlan })
}
