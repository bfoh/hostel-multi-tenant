import { Redis } from '@upstash/redis'
import { VERTICALS, verticalRootDomain, type BusinessType } from './host-classification'

export interface TenantRecord {
  id: string
  slug: string
  name: string
  domain: string | null
  plan: 'starter' | 'growth'
  isActive: boolean
  status: 'trial' | 'active' | 'trial_expired' | 'suspended' | 'cancelled'
  businessType: BusinessType
  branding: {
    primaryColor: string | null
    logoUrl: string | null
    faviconUrl: string | null
  }
}

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null // Redis not configured — skip cache, go straight to DB
  }
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
  return redis
}

const APP_DOMAIN = (process.env.APP_DOMAIN ?? process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'aya.com')
  .replace(/^https?:\/\//, '')
  .replace(/\/+$/, '')
const ROOT_DOMAIN = APP_DOMAIN.startsWith('app.') ? APP_DOMAIN.slice(4) : APP_DOMAIN
const CACHE_TTL = 300 // 5 minutes

/**
 * Resolve a tenant from an incoming hostname.
 *
 * Resolution order:
 * 1. Check Upstash Redis cache (TTL = 5 min)
 * 2. On miss, query Supabase REST directly (no SDK — avoids cookie overhead in Edge)
 * 3. Write result back to cache
 *
 * Hostname formats handled:
 *   - {slug}.hostels.<domain>  → hostel tenant, platform subdomain
 *   - {slug}.hotels.<domain>   → hotel tenant, platform subdomain
 *   - <domain> / www.         → apex marketing site — no tenant
 *   - hostels.<domain>        → hostel marketplace root — no tenant
 *   - hotels.<domain>         → hotel marketplace root — no tenant
 *   - app.<domain>            → mobile app fixed host — no tenant (resolved via JWT/DB elsewhere)
 *   - anything else           → treated as a tenant's custom_domain
 */
export async function resolveTenant(hostname: string): Promise<TenantRecord | null> {
  const host = normaliseHostname(hostname)

  // Platform-level hosts with no tenant of their own: apex, either bare
  // vertical root, the fixed mobile host, or local dev.
  const isVerticalRoot = VERTICALS.some((t) => host === verticalRootDomain(ROOT_DOMAIN, t))
  if (host === ROOT_DOMAIN || host === `app.${ROOT_DOMAIN}` || host === 'localhost' || isVerticalRoot) {
    return null
  }

  const cacheKey = `tenant:host:${host}`

  // ── Cache hit ──────────────────────────────────────────────────────────────
  try {
    const r = getRedis()
    if (r) {
      const cached = await r.get<TenantRecord>(cacheKey)
      if (cached) return cached
    }
  } catch {
    // Redis down — degrade gracefully, continue to DB lookup
  }

  // ── Database lookup ────────────────────────────────────────────────────────
  const tenant = await fetchTenantFromDB(host)

  // ── Cache write ────────────────────────────────────────────────────────────
  if (tenant) {
    try {
      const r = getRedis()
      if (r) await r.set(cacheKey, tenant, { ex: CACHE_TTL })
    } catch {
      // Non-fatal — next request will just hit DB again
    }
  }

  return tenant
}

/**
 * Direct slug lookup, bypassing hostname parsing entirely — used by
 * impersonation (middleware.ts), which already knows the exact slug and
 * has no real incoming hostname to reconstruct one from.
 */
export async function resolveTenantBySlug(slug: string): Promise<TenantRecord | null> {
  return fetchTenantByFilter(`slug=eq.${encodeURIComponent(slug)}`)
}

/**
 * Normalise hostname: lowercase, strip port, strip leading www.
 */
function normaliseHostname(hostname: string): string {
  return hostname
    .split(':')[0]          // strip port
    .toLowerCase()
    .replace(/^www\./, '') // strip www
}

/**
 * Direct Supabase REST call — no SDK to keep Edge bundle tiny.
 * Looks up by subdomain (under either vertical root) OR custom domain.
 */
async function fetchTenantFromDB(host: string): Promise<TenantRecord | null> {
  let slug: string | undefined
  let expectedBusinessType: BusinessType | undefined

  for (const type of VERTICALS) {
    const vRoot = verticalRootDomain(ROOT_DOMAIN, type)
    const match = host.match(new RegExp(`^([^.]+)\\.${escapeRegExp(vRoot)}$`))
    if (match) {
      slug = match[1]
      expectedBusinessType = type
      break
    }
  }

  const filter = slug
    ? `slug=eq.${encodeURIComponent(slug)}`
    : `custom_domain=eq.${encodeURIComponent(host)}`

  const tenant = await fetchTenantByFilter(filter)

  // Defensive consistency check: a subdomain under hostels.<domain> must
  // actually belong to a hostel tenant, and likewise for hotels.<domain>.
  // Guards against a stale/mistyped link resolving the wrong vertical's
  // tenant just because the slug happens to collide.
  if (tenant && expectedBusinessType && tenant.businessType !== expectedBusinessType) {
    return null
  }

  return tenant
}

async function fetchTenantByFilter(filter: string): Promise<TenantRecord | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  // Use service role key to bypass RLS — tenant resolution is server-side only
  const supabaseAnonKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const url = `${supabaseUrl}/rest/v1/tenants?${filter}&select=id,slug,name,custom_domain,plan,is_active,status,business_type,primary_color,logo_url,favicon_url&limit=1`

  const res = await fetch(url, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      Accept: 'application/json',
    },
    // Edge runtime — no node-fetch cache
    cache: 'no-store',
  })

  if (!res.ok) return null

  const rows = await res.json()
  if (!Array.isArray(rows) || rows.length === 0) return null

  const row = rows[0]
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    domain: row.custom_domain ?? null,
    plan: row.plan,
    isActive: row.is_active,
    status: row.status,
    businessType: row.business_type,
    branding: {
      primaryColor: row.primary_color ?? null,
      logoUrl: row.logo_url ?? null,
      faviconUrl: row.favicon_url ?? null,
    },
  }
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Bust the cache for a specific tenant host — call after config changes.
 */
export async function invalidateTenantCache(hostname: string): Promise<void> {
  const host = normaliseHostname(hostname)
  try {
    const r = getRedis()
    if (r) await r.del(`tenant:host:${host}`)
  } catch {
    // Non-fatal
  }
}
