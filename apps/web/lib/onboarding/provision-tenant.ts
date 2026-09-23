import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Single source of truth for tenant-bootstrap logic. Previously duplicated
 * three times (app/auth/callback/route.ts, app/api/onboarding/provision/route.ts,
 * app/onboarding/page.tsx's inline fallback) with slightly different shapes —
 * only two of the three set enquiry_webhook_secret, for example, and none of
 * them persisted a vertical. Centralizing here also gives the hotel vertical
 * one place to persist business_type instead of a fourth copy of this logic.
 */

export type BusinessType = 'hostel' | 'hotel'

export interface ProvisionTenantParams {
  userId: string
  /** Raw hostel/hotel name from signup metadata — may be empty/whitespace. */
  rawName: string | null | undefined
  /**
   * Which vertical this tenant belongs to. Defaults to 'hostel' — every
   * caller today predates the hotel vertical's signup-flow branching
   * (Phase 4), so this preserves exactly today's behavior until a real
   * value is threaded through.
   */
  businessType?: BusinessType
}

export interface ProvisionedTenant {
  tenantId: string
  slug: string
  alreadyExists: boolean
}

const DEFAULT_NAME_BY_TYPE: Record<BusinessType, string> = {
  hostel: 'My Hostel',
  hotel: 'My Hotel',
}

/**
 * Idempotently provisions (or looks up) the tenant + owner membership for a
 * newly-verified user. Safe to call unconditionally — if the user already
 * has an active tenant membership, that tenant is returned as-is with
 * alreadyExists: true and nothing is written.
 */
export async function provisionTenant({
  userId,
  rawName,
  businessType = 'hostel',
}: ProvisionTenantParams): Promise<ProvisionedTenant> {
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('tenant_members')
    .select('tenant_id, tenants(slug)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (existing?.tenant_id) {
    const t = Array.isArray(existing.tenants) ? existing.tenants[0] : existing.tenants
    return {
      tenantId: existing.tenant_id,
      slug: (t as { slug?: string } | null)?.slug ?? '',
      alreadyExists: true,
    }
  }

  const name = (rawName ?? '').trim() || DEFAULT_NAME_BY_TYPE[businessType]
  const baseSlug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || businessType

  let slug = baseSlug
  let attempt = 0
  while (true) {
    const { data: taken } = await admin.from('tenants').select('id').eq('slug', slug).maybeSingle()
    if (!taken) break
    attempt++
    slug = `${baseSlug}-${attempt}`
  }

  const { data: tenant, error: tenantErr } = await admin
    .from('tenants')
    .insert({
      name,
      slug,
      status: 'trial',
      onboarding_completed: false,
      enquiry_webhook_secret: crypto.randomUUID(),
      business_type: businessType,
    })
    .select('id, slug')
    .single()

  if (tenantErr || !tenant) {
    throw new Error(tenantErr?.message ?? 'Failed to create tenant')
  }

  const { error: memberErr } = await admin.from('tenant_members').insert({
    tenant_id: tenant.id,
    user_id: userId,
    role: 'owner',
    is_active: true,
    joined_at: new Date().toISOString(),
  })

  if (memberErr) {
    // Clean up the orphaned tenant so a retry doesn't collide on this slug.
    await admin.from('tenants').delete().eq('id', tenant.id)
    throw new Error(memberErr.message)
  }

  return { tenantId: tenant.id, slug: tenant.slug, alreadyExists: false }
}
