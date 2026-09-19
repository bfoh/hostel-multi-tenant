/**
 * Shared tenant/role resolver for the mobile app's entry points
 * (owner-digest gate + pages, /api/mobile/role, /api/mobile/tenant-theme).
 *
 * The mobile shell always talks to the single fixed host
 * app.gh-hostels.com (no per-tenant subdomain the way a browser has), so
 * these routes can't rely on subdomain-based tenant resolution and instead
 * look the user's membership up directly by user_id — the same reasoning
 * as getOccupantSession().
 *
 * Every one of these call sites used to do this with `.maybeSingle()` (or,
 * in getOccupantSession's case, `.single()`), which THROWS when more than
 * one row matches. Supabase-js swallows that into `{ data: null, error }`
 * when destructured for just `data`, which every call site here does — so
 * in production this didn't crash the request, it silently made a real
 * owner/occupant look like they had no membership at all. Concretely: an
 * owner of two hostels (the existing Portfolio feature already supports
 * this) opening the mobile app's daily digest was redirected to /login.
 *
 * Fix: order + limit(1) instead of single()/maybeSingle(), so this
 * degrades to "pick one" for a multi-tenant user rather than "pretend they
 * have none". Which one is picked (most-recently-active membership) is a
 * reasonable default, not a real multi-tenant switcher — see
 * docs/superpowers/specs/2026-05-22-mobile-app-design.md for why a full
 * switcher UI was explicitly decided against for v1.
 */
import { createAdminClient } from '@/lib/supabase/admin'

export interface MobileUserContext {
  userId:     string
  role:       'owner' | 'occupant' | null
  tenantId:   string | null
}

/**
 * Resolves the tenant context for a mobile-app user, preferring an active
 * owner membership over an occupant record (matches the existing routing
 * priority in apps/mobile/src/main.ts's routeByRole()).
 */
export async function resolveMobileContext(userId: string): Promise<MobileUserContext> {
  const admin = createAdminClient() as any

  const { data: ownerRows } = await admin
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)

  const ownerTenantId = ownerRows?.[0]?.tenant_id as string | undefined
  if (ownerTenantId) {
    return { userId, role: 'owner', tenantId: ownerTenantId }
  }

  const { data: occupantRows } = await admin
    .from('occupants')
    .select('tenant_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  const occupantTenantId = occupantRows?.[0]?.tenant_id as string | undefined
  if (occupantTenantId) {
    return { userId, role: 'occupant', tenantId: occupantTenantId }
  }

  return { userId, role: null, tenantId: null }
}

/**
 * Same resolution, but scoped to an already-known tenant_id when the
 * caller has one (e.g. from the x-tenant-id header on a warm launch) —
 * confirms the membership is for *that* tenant specifically rather than
 * picking whichever one is most recent. Falls back to the unscoped
 * resolution if the scoped lookup finds nothing (matches the previous
 * owner-digest layout behaviour of "prefer the header's tenant, but don't
 * hard-fail if it doesn't match an owner row").
 */
export async function resolveMobileContextForTenant(
  userId: string,
  tenantId: string | null,
): Promise<MobileUserContext> {
  if (!tenantId) return resolveMobileContext(userId)

  const admin = createAdminClient() as any
  const { data: ownerRows } = await admin
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .eq('role', 'owner')
    .eq('is_active', true)
    .limit(1)

  if (ownerRows?.[0]) {
    return { userId, role: 'owner', tenantId }
  }

  return resolveMobileContext(userId)
}
