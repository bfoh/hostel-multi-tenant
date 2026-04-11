import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { resolveTenant } from '@/lib/tenant/resolve'

const BYPASS_PATHS = ['/widget', '/api/webhooks', '/_next', '/favicon.ico', '/robots.txt', '/sitemap.xml']
const NO_AUTH_PATHS = ['/book', '/portal', '/api/public', '/api/widget']
const AUTH_PATHS    = ['/login', '/signup', '/forgot-password', '/reset-password', '/invite', '/auth/invite']
const PORTAL_PATHS  = ['/staff-portal', '/occupant-portal']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') ?? ''

  if (BYPASS_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next()

  const isNoAuth = NO_AUTH_PATHS.some((p) => pathname.startsWith(p))
  const tenant   = await resolveTenant(hostname)

  if (!tenant && !isAppDomain(hostname)) {
    return new NextResponse('Hostel not found', { status: 404 })
  }
  if (tenant && !tenant.isActive && !pathname.startsWith('/api/')) {
    return NextResponse.rewrite(new URL('/maintenance', request.url))
  }

  // ── Build request headers we'll forward downstream ──────────────────────
  // IMPORTANT: We must use NextResponse.next({ request: { headers } }) to
  // make custom headers readable via next/headers in server components and
  // API routes. Setting response.headers only sends them to the browser.
  const reqHeaders = new Headers(request.headers)

  // ── No-auth paths ─────────────────────────────────────────────────────────
  if (isNoAuth) {
    if (tenant) injectHeaders(reqHeaders, tenant)
    return NextResponse.next({ request: { headers: reqHeaders } })
  }

  // ── Auth session (cookie refresh) ─────────────────────────────────────────
  // We need a mutable response for Supabase to write refreshed cookie values.
  // We'll reconstruct the final response after we know all headers.
  let cookieResponse = NextResponse.next({ request: { headers: reqHeaders } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          cookieResponse = NextResponse.next({ request: { headers: reqHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const isAuthPath   = AUTH_PATHS.some((p) => pathname.startsWith(p))
  const isPortalPath = PORTAL_PATHS.some((p) => pathname.startsWith(p))

  // ── Unauthenticated redirect ───────────────────────────────────────────────
  if (!user && !isAuthPath && pathname !== '/') {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── Decode JWT claims ──────────────────────────────────────────────────────
  let claims: Record<string, string> | null = null
  if (user) {
    const { data: { session } } = await supabase.auth.getSession()
    claims = session?.access_token ? decodeJwtPayload(session.access_token) : null
  }

  // ── Resolve true portal role — DB is authoritative, not JWT ─────────────────
  // JWT claims can be stale (e.g. occupant invited before user_id was linked,
  // or hook order changed). Always verify against the occupants table live.
  let portalRole = claims?.portal_role ?? 'admin'
  if (user && portalRole !== 'occupant') {
    const isOccupant = await checkIsOccupant(user.id)
    if (isOccupant) portalRole = 'occupant'
  }

  // ── Auth path redirect ─────────────────────────────────────────────────────
  if (user && isAuthPath) {
    if (portalRole === 'occupant') return NextResponse.redirect(new URL('/occupant-portal', request.url))
    if (portalRole === 'staff')    return NextResponse.redirect(new URL('/staff-portal', request.url))
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // ── Portal access guards ───────────────────────────────────────────────────
  // Occupants/staff-portal users trying to hit the admin app → redirect to their portal
  const ADMIN_APP_PATHS = ['/dashboard', '/rooms', '/occupants', '/bookings', '/staff',
    '/reports', '/accounting', '/maintenance', '/assets', '/settings',
    '/portfolio', '/invoices', '/payments', '/intelligence', '/ai',
    '/activity', '/waiting-list', '/housekeeping', '/security', '/lost-found',
    '/kiosk', '/communications']
  if (!isPortalPath && !isAuthPath && ADMIN_APP_PATHS.some(p => pathname.startsWith(p))) {
    if (portalRole === 'occupant') return NextResponse.redirect(new URL('/occupant-portal', request.url))
    if (portalRole === 'staff')    return NextResponse.redirect(new URL('/staff-portal', request.url))
  }

  // ── Admin-only route guard (within the admin app) ──────────────────────────
  // Staff roles (receptionist, housekeeper, etc.) must not access admin-only sections
  const ADMIN_ONLY_PATHS = [
    '/portfolio', '/invoices', '/payments', '/accounting', '/staff',
    '/assets', '/waiting-list', '/reports', '/intelligence', '/ai',
    '/activity', '/settings',
  ]
  const tenantRole = claims?.tenant_role ?? ''
  const isAdminRole = ['owner', 'manager', 'admin'].includes(tenantRole)
  if (
    !isPortalPath && !isAuthPath &&
    portalRole !== 'occupant' && portalRole !== 'staff' &&  // already handled above
    !isAdminRole && tenantRole &&                            // has a role but not admin
    ADMIN_ONLY_PATHS.some(p => pathname.startsWith(p))
  ) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // ── Resolve tenant and inject into request headers ────────────────────────
  if (tenant) {
    // Subdomain-resolved tenant — always fresh (backed by Redis cache)
    injectHeaders(reqHeaders, tenant)
  } else if (claims?.tenant_id) {
    // No subdomain (localhost / root domain): seed metadata from JWT claims,
    // then fetch fresh branding from DB so color/logo changes apply immediately
    // without requiring a re-login.
    reqHeaders.set('x-tenant-id',   claims.tenant_id)
    reqHeaders.set('x-tenant-slug', claims.tenant_slug  ?? '')
    reqHeaders.set('x-tenant-name', claims.tenant_name  ?? '')
    if (claims.tenant_logo)  reqHeaders.set('x-tenant-logo',  claims.tenant_logo)
    if (claims.tenant_color) reqHeaders.set('x-tenant-color', claims.tenant_color)
    // Override branding with fresh DB values
    const freshBranding = await fetchBrandingForTenant(claims.tenant_id)
    if (freshBranding) {
      if (freshBranding.primaryColor) reqHeaders.set('x-tenant-color',   freshBranding.primaryColor)
      else reqHeaders.delete('x-tenant-color')
      if (freshBranding.logoUrl)      reqHeaders.set('x-tenant-logo',    freshBranding.logoUrl)
      else reqHeaders.delete('x-tenant-logo')
      if (freshBranding.faviconUrl)   reqHeaders.set('x-tenant-favicon', freshBranding.faviconUrl)
      else reqHeaders.delete('x-tenant-favicon')
    }
  } else if (user) {
    // Fallback: no JWT claims — look up tenant from DB.
    // Check tenant_members first (admin/staff), then occupants table.
    const tenantFromDB = await fetchTenantForUser(user.id)
    if (tenantFromDB) {
      const { tenant: t, role } = tenantFromDB
      reqHeaders.set('x-tenant-id',   t.id)
      reqHeaders.set('x-tenant-slug', t.slug)
      reqHeaders.set('x-tenant-name', t.name)
      if (t.branding.primaryColor) reqHeaders.set('x-tenant-color',   t.branding.primaryColor)
      if (t.branding.logoUrl)      reqHeaders.set('x-tenant-logo',    t.branding.logoUrl)
      if (t.branding.faviconUrl)   reqHeaders.set('x-tenant-favicon', t.branding.faviconUrl)
      reqHeaders.set('x-tenant-role', role)
    } else {
      // Try occupants table (occupant portal users are not in tenant_members)
      const tenantFromOccupant = await fetchTenantForOccupant(user.id)
      if (tenantFromOccupant) {
        reqHeaders.set('x-tenant-id',   tenantFromOccupant.id)
        reqHeaders.set('x-tenant-slug', tenantFromOccupant.slug)
        reqHeaders.set('x-tenant-name', tenantFromOccupant.name)
        if (tenantFromOccupant.branding.primaryColor) reqHeaders.set('x-tenant-color',   tenantFromOccupant.branding.primaryColor)
        if (tenantFromOccupant.branding.logoUrl)      reqHeaders.set('x-tenant-logo',    tenantFromOccupant.branding.logoUrl)
        if (tenantFromOccupant.branding.faviconUrl)   reqHeaders.set('x-tenant-favicon', tenantFromOccupant.branding.faviconUrl)
      }
    }
  }

  if (claims?.portal_role)  reqHeaders.set('x-portal-role',  claims.portal_role)
  if (claims?.occupant_id) reqHeaders.set('x-occupant-id',  claims.occupant_id)

  // Always fetch role fresh from DB — JWT claims are stale after role changes
  const resolvedTenantIdForRole = reqHeaders.get('x-tenant-id')
  if (user && resolvedTenantIdForRole) {
    const freshRole = await fetchRoleForUser(user.id, resolvedTenantIdForRole)
    if (freshRole) reqHeaders.set('x-tenant-role', freshRole)
    else if (claims?.tenant_role) reqHeaders.set('x-tenant-role', claims.tenant_role)
  }

  // ── Impersonation override ─────────────────────────────────────────────────
  const impersonateTenantId   = request.cookies.get('x-admin-impersonate-tenant')?.value
  const impersonateTenantSlug = request.cookies.get('x-admin-impersonate-slug')?.value
  if (impersonateTenantId && impersonateTenantSlug && user) {
    reqHeaders.set('x-tenant-id',          impersonateTenantId)
    reqHeaders.set('x-tenant-slug',        impersonateTenantSlug)
    reqHeaders.set('x-admin-impersonating','true')
  }

  // ── Subdomain redirect (production only) ──────────────────────────────────
  // Authenticated users landing on the app/root domain are redirected to their
  // tenant subdomain so the app always runs at slug.gh-hostels.com.
  // Never fires on localhost — subdomains don't resolve in local browsers.
  {
    const appDomain    = process.env.APP_DOMAIN ?? process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'
    const hostBase     = hostname.split(':')[0].toLowerCase()
    const isLocalDev   = hostBase === 'localhost' || hostBase === '127.0.0.1'
    const onRootDomain = !isLocalDev && (hostBase === appDomain || hostBase === `app.${appDomain}`)
    const resolvedSlug = reqHeaders.get('x-tenant-slug')

    if (
      user && resolvedSlug && onRootDomain &&
      !isAuthPath && !isPortalPath &&
      !pathname.startsWith('/onboarding') &&
      !pathname.startsWith('/api/')
    ) {
      const dest = `https://${resolvedSlug}.${appDomain}${pathname}${request.nextUrl.search}`
      return NextResponse.redirect(dest)
    }
  }

  // Rebuild final response with the updated request headers (so server
  // components and API routes can read them via next/headers) while keeping
  // any Set-Cookie headers Supabase wrote during session refresh.
  const finalResponse = NextResponse.next({ request: { headers: reqHeaders } })
  cookieResponse.cookies.getAll().forEach(c =>
    finalResponse.cookies.set(c.name, c.value, c as any)
  )

  // Also persist tenant_id in a cookie so fetch() API calls from the browser
  // always carry it without relying on header injection.
  const resolvedTenantId = reqHeaders.get('x-tenant-id')
  if (resolvedTenantId) {
    const existing = request.cookies.get('__tenant_id')?.value
    if (existing !== resolvedTenantId) {
      finalResponse.cookies.set('__tenant_id', resolvedTenantId, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        // No maxAge — session cookie, cleared on browser close
      })
    }
  } else {
    // No tenant found — clear stale cookie
    if (request.cookies.get('__tenant_id')) {
      finalResponse.cookies.delete('__tenant_id')
    }
  }

  return finalResponse
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function injectHeaders(h: Headers, tenant: Awaited<ReturnType<typeof resolveTenant>> & object) {
  h.set('x-tenant-id',   tenant.id)
  h.set('x-tenant-slug', tenant.slug)
  h.set('x-tenant-name', tenant.name)
  if (tenant.branding.primaryColor) h.set('x-tenant-color',   tenant.branding.primaryColor)
  else h.delete('x-tenant-color')
  if (tenant.branding.logoUrl)      h.set('x-tenant-logo',    tenant.branding.logoUrl)
  else h.delete('x-tenant-logo')
  if (tenant.branding.faviconUrl)   h.set('x-tenant-favicon', tenant.branding.faviconUrl)
  else h.delete('x-tenant-favicon')
}

function decodeJwtPayload(token: string): Record<string, string> | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    return JSON.parse(Buffer.from(part, 'base64').toString('utf8'))
  } catch { return null }
}

function isAppDomain(hostname: string): boolean {
  const appDomain = process.env.APP_DOMAIN ?? process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'
  const h = hostname.split(':')[0].toLowerCase()
  return h === appDomain || h === `app.${appDomain}` || h === 'localhost'
}

interface TenantWithRole {
  tenant: import('@/lib/tenant/resolve').TenantRecord
  role:   string
}

async function fetchTenantForUser(userId: string): Promise<TenantWithRole | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const url = `${supabaseUrl}/rest/v1/tenant_members?user_id=eq.${userId}&is_active=eq.true&select=role,tenants(id,slug,name,plan,is_active,primary_color,logo_url)&limit=1`

  try {
    const res = await fetch(url, {
      headers: {
        apikey:        supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Accept:        'application/json',
      },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const rows = await res.json()
    if (!Array.isArray(rows) || rows.length === 0) return null
    const t = Array.isArray(rows[0].tenants) ? rows[0].tenants[0] : rows[0].tenants
    if (!t) return null
    return {
      role: rows[0].role ?? 'staff',
      tenant: {
        id: t.id, slug: t.slug, name: t.name, domain: null, plan: t.plan,
        isActive: t.is_active,
        branding: { primaryColor: t.primary_color ?? null, logoUrl: t.logo_url ?? null, faviconUrl: null },
      },
    }
  } catch {
    return null
  }
}

interface TenantBranding {
  primaryColor: string | null
  logoUrl: string | null
  faviconUrl: string | null
}

async function checkIsOccupant(userId: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const url = `${supabaseUrl}/rest/v1/occupants?user_id=eq.${userId}&select=id&limit=1`
  try {
    const res = await fetch(url, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      cache: 'no-store',
    })
    if (!res.ok) return false
    const rows = await res.json()
    return Array.isArray(rows) && rows.length > 0
  } catch { return false }
}

async function fetchTenantForOccupant(userId: string): Promise<import('@/lib/tenant/resolve').TenantRecord | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const url = `${supabaseUrl}/rest/v1/occupants?user_id=eq.${userId}&select=tenant_id,tenants(id,slug,name,plan,is_active,primary_color,logo_url,favicon_url)&limit=1`
  try {
    const res = await fetch(url, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const rows = await res.json()
    if (!Array.isArray(rows) || rows.length === 0) return null
    const t = Array.isArray(rows[0].tenants) ? rows[0].tenants[0] : rows[0].tenants
    if (!t) return null
    return {
      id: t.id, slug: t.slug, name: t.name, domain: null, plan: t.plan,
      isActive: t.is_active,
      branding: { primaryColor: t.primary_color ?? null, logoUrl: t.logo_url ?? null, faviconUrl: t.favicon_url ?? null },
    }
  } catch { return null }
}

async function fetchBrandingForTenant(tenantId: string): Promise<TenantBranding | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const url = `${supabaseUrl}/rest/v1/tenants?id=eq.${tenantId}&select=primary_color,logo_url,favicon_url&limit=1`
  try {
    const res = await fetch(url, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const rows = await res.json()
    if (!Array.isArray(rows) || rows.length === 0) return null
    return {
      primaryColor: rows[0].primary_color ?? null,
      logoUrl:      rows[0].logo_url      ?? null,
      faviconUrl:   rows[0].favicon_url   ?? null,
    }
  } catch { return null }
}

async function fetchRoleForUser(userId: string, tenantId: string): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const url = `${supabaseUrl}/rest/v1/tenant_members?user_id=eq.${userId}&tenant_id=eq.${tenantId}&is_active=eq.true&select=role&limit=1`
  try {
    const res = await fetch(url, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const rows = await res.json()
    return rows?.[0]?.role ?? null
  } catch { return null }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)'],
}
