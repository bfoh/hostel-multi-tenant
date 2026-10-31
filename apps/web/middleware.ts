import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { resolveTenant, resolveTenantBySlug } from '@/lib/tenant/resolve'
import { classifyHost, tenantHost, type BusinessType } from '@/lib/tenant/host-classification'
import { isUnderPath } from '@/lib/path-prefix'

const BYPASS_PATHS = [
  '/widget',
  '/api/cron',
  '/api/payments/paystack/webhook',
  '/api/auth/forgot-password',
  '/api/auth/signup',
  '/api/auth/resend-confirmation',
  '/auth/callback',
  '/auth/confirm',
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
]
// The last four are the generated PWA manifest and link-preview images plus
// /.well-known probes: browsers and social crawlers fetch them logged out,
// and a redirect to /login broke installs and link previews.
const NO_AUTH_PATHS = ['/book', '/checkin', '/portal', '/order', '/visit', '/compare', '/privacy', '/terms', '/browse', '/listing', '/for-owners', '/list-your-property', '/offline', '/api/public', '/api/widget', '/api/mobile/role', '/api/mobile/tenant-theme', '/manifest.webmanifest', '/opengraph-image', '/twitter-image', '/.well-known']
const AUTH_PATHS    = ['/login', '/signup', '/forgot-password', '/reset-password', '/invite', '/auth/invite']
const PORTAL_PATHS  = ['/staff-portal', '/occupant-portal']
// Reachable by a signed-in user who is not a member of the request's tenant:
// sign-out and account flows (set-password, OTP, invite acceptance), and the
// super-admin console, whose pages and APIs check platform_admins themselves.
const MEMBERSHIP_EXEMPT_PATHS = ['/api/auth', '/auth', '/admin', '/api/admin']
// The only APIs a resident (occupant, no tenant_members row) may call: their
// portal's own routes, resident↔staff messaging, and the mobile app's push
// registration and role lookup. Most staff APIs have no role check of their
// own, so everything else is refused for residents here.
const RESIDENT_API_PATHS = ['/api/occupant', '/api/messages', '/api/push', '/api/mobile']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') ?? ''

  if (BYPASS_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next()

  // Skip static assets (images, fonts, videos served from /public)
  if (/\.(png|jpe?g|gif|svg|ico|webp|mp4|webm|woff2?|ttf|eot|css|js)$/i.test(pathname)) {
    return NextResponse.next()
  }

  // ── /admin/* must live on the platform domain only ─────────────────────
  // Super-admin pages should never render on a tenant subdomain or custom
  // hostel domain. Redirect off-platform hits to the platform root domain.
  if (pathname.startsWith('/admin')) {
    const appDomain  = (process.env.APP_DOMAIN ?? process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'aya.com').replace(/^https?:\/\//, '').replace(/\/+$/, '')
    const hostBase   = hostname.split(':')[0].toLowerCase()
    const isLocalDev = hostBase === 'localhost' || hostBase === '127.0.0.1'
    const onPlatform = isLocalDev || hostBase === appDomain || hostBase === `app.${appDomain}`
    if (!onPlatform) {
      return NextResponse.redirect(`https://${appDomain}${pathname}${request.nextUrl.search}`)
    }
  }

  // Whole-segment match: a bare startsWith() made the dashboard's /bookings
  // and /visitors public via '/book' and '/visit'.
  const isNoAuth = NO_AUTH_PATHS.some((p) => isUnderPath(pathname, p))
  const tenant   = await resolveTenant(hostname)

  if (!tenant && !isAppDomain(hostname)) {
    return new NextResponse('Hostel not found', { status: 404 })
  }
  if (tenant && !tenant.isActive && !pathname.startsWith('/api/')) {
    return NextResponse.rewrite(new URL('/suspended', request.url))
  }

  // ── Build request headers we'll forward downstream ──────────────────────
  // IMPORTANT: We must use NextResponse.next({ request: { headers } }) to
  // make custom headers readable via next/headers in server components and
  // API routes. Setting response.headers only sends them to the browser.
  const reqHeaders = new Headers(request.headers)

  // SECURITY: strip any client-supplied tenant/portal/impersonation headers
  // before anything below sets its own trusted values. Without this, a
  // request that never gets a tenant resolved below (e.g. hitting the app
  // root domain on a NO_AUTH_PATHS route, where injection is conditional)
  // would forward the caller's own forged `x-tenant-id` straight through —
  // and pages like /book and /portal read that header directly with no
  // other verification. Only this middleware may ever set these headers.
  for (const h of [
    'x-tenant-id', 'x-tenant-slug', 'x-tenant-name', 'x-tenant-color',
    'x-tenant-logo', 'x-tenant-favicon', 'x-tenant-domain', 'x-tenant-role',
    'x-tenant-status', 'x-tenant-business-type', 'x-business-type', 'x-portal-role',
    'x-occupant-id', 'x-admin-impersonating',
  ]) {
    reqHeaders.delete(h)
  }
  // Same for the __tenant_id cookie: getServerTenantId() and
  // createTenantAdminClientFromHeaders() fall back to it when x-tenant-id is
  // absent, so a forged value let a signed-in account with no property write
  // to any tenant from the root domain. The tenant resolved below is the only
  // one downstream code may see; the cookie is re-set from it at the end.
  stripRequestCookie(reqHeaders, '__tenant_id')

  // Which vertical's marketplace/marketing site this request is for —
  // meaningful independent of any specific tenant (an anonymous visitor
  // browsing hotels.<domain> has no tenant at all, but the marketplace
  // pages still need to know which vertical's copy/data to render).
  {
    const hostClass = classifyHost(hostname, process.env.APP_DOMAIN ?? process.env.NEXT_PUBLIC_APP_DOMAIN)
    if (hostClass.businessType) reqHeaders.set('x-business-type', hostClass.businessType)
  }

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

  // ── Forced password change guard ───────────────────────────────────────────
  // When an admin (re)sends portal credentials, the API stamps
  // user_metadata.must_change_password = true and rotates the password.
  // Block every page except /auth/set-password until the user picks a fresh
  // password — otherwise a lingering session would let them skip the prompt.
  // /api/* is allowed so signout, set-password's updateUser call, and any
  // background fetches continue to work.
  const mustChangePw = user?.user_metadata?.must_change_password === true
  if (
    user && mustChangePw &&
    !pathname.startsWith('/auth/set-password') &&
    !pathname.startsWith('/api/')
  ) {
    const fallback = portalRole === 'occupant' ? '/occupant-portal/profile' : '/dashboard'
    const target   = (isAuthPath || pathname === '/') ? fallback : pathname
    const url      = new URL('/auth/set-password', request.url)
    url.searchParams.set('next', target)
    return NextResponse.redirect(url)
  }

  // ── Auth path redirect ─────────────────────────────────────────────────────
  if (user && isAuthPath) {
    if (portalRole === 'occupant') return NextResponse.redirect(new URL('/occupant-portal', request.url))
    if (portalRole === 'staff')    return NextResponse.redirect(new URL('/dashboard', request.url))
    // Preserve plan intent when an already-logged-in user clicks a Subscribe
    // link on the landing page (e.g. /signup?plan=growth). Send them directly
    // to the billing page so autosubscribe fires, rather than discarding the
    // plan param and dropping them at /dashboard.
    const plan = request.nextUrl.searchParams.get('plan')
    if (plan && ['starter', 'growth'].includes(plan)) {
      return NextResponse.redirect(new URL(`/settings/billing?autosubscribe=${plan}`, request.url))
    }
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // ── Portal access guards ───────────────────────────────────────────────────
  // Occupants/staff-portal users trying to hit the admin app → redirect to their portal
  const ADMIN_APP_PATHS = ['/dashboard', '/rooms', '/occupants', '/bookings', '/staff',
    '/reports', '/accounting', '/maintenance', '/assets', '/settings',
    '/portfolio', '/invoices', '/payments', '/intelligence', '/ai',
    '/activity', '/waiting-list', '/housekeeping', '/security', '/lost-found',
    '/kiosk', '/communications', '/my-account']
  if (!isPortalPath && !isAuthPath && ADMIN_APP_PATHS.some(p => isUnderPath(pathname, p))) {
    if (portalRole === 'occupant') return NextResponse.redirect(new URL('/occupant-portal', request.url))
  }

  // ── Backward compatibility for old staff portal links ──────────────────────
  if (pathname.startsWith('/staff-portal')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // ── Admin-only route guard (within the admin app) ──────────────────────────
  // Staff roles (receptionist, housekeeper, etc.) must not access admin-only
  // sections. Whole-segment matching: '/staff' must not catch /staff-mobile,
  // the mobile app's home for exactly these roles.
  const ADMIN_ONLY_PATHS = [
    '/portfolio', '/invoices', '/payments', '/accounting', '/staff',
    '/assets', '/waiting-list', '/reports', '/intelligence', '/ai',
    '/activity', '/settings',
  ]
  const tenantRole = claims?.tenant_role ?? ''
  const isAdminRole = ['owner', 'manager', 'admin'].includes(tenantRole)
  if (
    !isPortalPath && !isAuthPath &&
    portalRole !== 'occupant' && // already handled above
    !isAdminRole && tenantRole &&                            // has a role but not admin
    ADMIN_ONLY_PATHS.some(p => isUnderPath(pathname, p))
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
    if (claims.tenant_logo)   reqHeaders.set('x-tenant-logo',   claims.tenant_logo)
    if (claims.tenant_color)  reqHeaders.set('x-tenant-color',  claims.tenant_color)
    if (claims.tenant_domain) reqHeaders.set('x-tenant-domain', claims.tenant_domain)
    // Override branding with fresh DB values
    const freshBranding = await fetchBrandingForTenant(claims.tenant_id)
    if (freshBranding) {
      if (freshBranding.primaryColor) reqHeaders.set('x-tenant-color',   freshBranding.primaryColor)
      else reqHeaders.delete('x-tenant-color')
      if (freshBranding.logoUrl)      reqHeaders.set('x-tenant-logo',    freshBranding.logoUrl)
      else reqHeaders.delete('x-tenant-logo')
      if (freshBranding.faviconUrl)   reqHeaders.set('x-tenant-favicon', freshBranding.faviconUrl)
      else reqHeaders.delete('x-tenant-favicon')
      if (freshBranding.customDomain) reqHeaders.set('x-tenant-domain',  freshBranding.customDomain)
      else reqHeaders.delete('x-tenant-domain')
      reqHeaders.set('x-tenant-status', freshBranding.status)
      reqHeaders.set('x-tenant-business-type', freshBranding.businessType)
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
      if (t.domain)                reqHeaders.set('x-tenant-domain',  t.domain)
      reqHeaders.set('x-tenant-role',   role)
      reqHeaders.set('x-tenant-status', t.status)
      reqHeaders.set('x-tenant-business-type', t.businessType)
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
        if (tenantFromOccupant.domain)                reqHeaders.set('x-tenant-domain',  tenantFromOccupant.domain)
        reqHeaders.set('x-tenant-status', tenantFromOccupant.status)
        reqHeaders.set('x-tenant-business-type', tenantFromOccupant.businessType)
      }
    }
  }

  if (claims?.portal_role)  reqHeaders.set('x-portal-role',  claims.portal_role)
  if (claims?.occupant_id) reqHeaders.set('x-occupant-id',  claims.occupant_id)

  // Always fetch role fresh from DB — JWT claims are stale after role changes.
  // No fallback to the JWT's tenant_role: on a subdomain that role belongs to
  // the user's own tenant, not the one in x-tenant-id.
  const resolvedTenantIdForRole = reqHeaders.get('x-tenant-id')
  let memberRole: string | null | undefined = null
  if (user && resolvedTenantIdForRole) {
    memberRole = await fetchRoleForUser(user.id, resolvedTenantIdForRole)
    if (memberRole) reqHeaders.set('x-tenant-role', memberRole)
  }

  // ── Impersonation override ─────────────────────────────────────────────────
  // Verify the impersonating user is actually a platform admin before honouring
  // the cookies — otherwise a stale/forged cookie could grant tenant access.
  // Also load the impersonated tenant's full record so branding (logo, color,
  // name, custom domain) is available downstream.
  const impersonateTenantId   = request.cookies.get('x-admin-impersonate-tenant')?.value
  const impersonateTenantSlug = request.cookies.get('x-admin-impersonate-slug')?.value
  if (impersonateTenantId && impersonateTenantSlug && user) {
    const sr  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/platform_admins?user_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`
    const verify = await fetch(url, {
      headers: { apikey: sr, Authorization: `Bearer ${sr}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    const adminRows = verify.ok ? await verify.json() : []

    if (Array.isArray(adminRows) && adminRows.length > 0) {
      const impTenant = await resolveTenantBySlug(impersonateTenantSlug)
      if (impTenant) {
        injectHeaders(reqHeaders, impTenant)
      } else {
        // Fallback to minimum context if tenant resolver missed
        reqHeaders.set('x-tenant-id',   impersonateTenantId)
        reqHeaders.set('x-tenant-slug', impersonateTenantSlug)
      }
      reqHeaders.set('x-tenant-role',         'owner')
      reqHeaders.set('x-admin-impersonating', 'true')
    }
  }

  // ── A property's own domain opens on that property ───────────────────────
  // `/` on a host that resolved to a tenant (its subdomain or custom domain)
  // used to render the global marketplace, listing other properties. Guests,
  // and anyone signed in without a role here, get the property's booking
  // page; its staff get the dashboard and its residents their portal. Only
  // `/` changes — every other path on the host behaves exactly as before.
  if (tenant && pathname === '/') {
    const isStaffHere = !!memberRole || reqHeaders.get('x-admin-impersonating') === 'true'
    const isResidentHere = !isStaffHere && !!user && portalRole === 'occupant' &&
      (await checkIsOccupantOfTenant(user.id, tenant.id)) === true
    const dest = new URL(isStaffHere ? '/dashboard' : isResidentHere ? '/occupant-portal' : '/book', request.url)
    if (!isStaffHere && !isResidentHere) dest.search = request.nextUrl.search
    const res = NextResponse.redirect(dest)
    cookieResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value, c as any))
    return res
  }

  // ── Tenant membership guard ────────────────────────────────────────────────
  // x-tenant-id comes from the hostname (subdomain or custom domain) or the
  // user's JWT claims; neither proves the signed-in user belongs to that
  // tenant. Dashboard pages read tenant data with the service-role client
  // keyed on that header, so without this check any signed-in account —
  // another property's owner or staff, a resident, or a brand-new signup —
  // could open a tenant's subdomain and read its dashboard. Residents keep
  // their portal (and its /api/occupant routes); everyone else needs an
  // active tenant_members row or a verified impersonation (set just above).
  const guardedTenantId = reqHeaders.get('x-tenant-id')
  if (
    user && guardedTenantId && !memberRole &&
    reqHeaders.get('x-admin-impersonating') !== 'true' &&
    !MEMBERSHIP_EXEMPT_PATHS.some((p) => isUnderPath(pathname, p))
  ) {
    const isApi = pathname.startsWith('/api/')
    const occupant = memberRole === undefined ? undefined : await checkIsOccupantOfTenant(user.id, guardedTenantId)
    if (memberRole === undefined || occupant === undefined) {
      return isApi
        ? NextResponse.json({ error: 'Could not verify access — try again.' }, { status: 503 })
        : new NextResponse('Could not verify your access. Please try again.', { status: 503 })
    }
    if (!occupant) return denyTenantAccess(isApi)
    if (isApi && !RESIDENT_API_PATHS.some((p) => isUnderPath(pathname, p))) {
      return denyTenantAccess(true)
    }
    if (!isPortalPath && !isApi && pathname !== '/') {
      return NextResponse.redirect(new URL('/occupant-portal', request.url))
    }
  }

  // ── Trial-expired minimal-dashboard guard ───────────────────────────────────
  // A tenant whose trial lapsed without subscribing (status='trial_expired')
  // keeps its public listing alive but loses full management-tool access —
  // only room-price editing, a read-only bookings view, and billing/account
  // basics stay reachable. Inverse of ADMIN_ONLY_PATHS above: an allow-list
  // keyed on tenant status rather than a deny-list keyed on role.
  const MINIMAL_DASHBOARD_ALLOWED_PATHS = [
    '/dashboard', '/rooms/categories', '/bookings',
    '/settings/billing', '/settings/listing', '/my-account', '/onboarding',
  ]
  const tenantStatus = reqHeaders.get('x-tenant-status')
  if (
    !isPortalPath && !isAuthPath &&
    portalRole !== 'occupant' &&
    tenantStatus === 'trial_expired' &&
    !MINIMAL_DASHBOARD_ALLOWED_PATHS.some(p => pathname.startsWith(p))
  ) {
    if (pathname.startsWith('/api/')) {
      // Read access stays available (historical reports, etc.) — only
      // mutation is blocked, so this doesn't need to enumerate every
      // read-only endpoint individually.
      if (request.method !== 'GET') {
        return NextResponse.json(
          { error: 'Your trial has ended — subscribe to unlock this feature.' },
          { status: 402 },
        )
      }
    } else {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // ── Subdomain redirect (production only) ──────────────────────────────────
  // Authenticated users landing on their vertical's bare root (hostels.<domain>
  // or hotels.<domain>) are redirected to their tenant subdomain so the app
  // always runs at slug.hostels.<domain> or slug.hotels.<domain>. Only fires
  // when the root they're on matches their own tenant's actual vertical — a
  // hostel owner browsing hotels.<domain> as a visitor stays there.
  // Never fires on localhost — subdomains don't resolve in local browsers.
  //
  // Deliberately excludes app.<domain>: the Capacitor mobile shell is locked
  // to that single fixed host (no subdomain-resolution capability — see
  // lib/auth/mobile-context.ts) and its WKWebView treats a redirect to a
  // different origin as an external navigation, handing off to the system
  // browser — which then has no session there (cookies are scoped to
  // app.<domain>) and bounces to that subdomain's own /login. This was
  // previously firing on every authenticated app.<domain> request (e.g.
  // /dashboard) — /onboarding was already excluded below, which is what
  // made this so confusing to track down: onboarding stayed put, but the
  // very next page a fresh signup hits (dashboard, redirecting them back to
  // onboarding) triggered the same bug one hop later.
  {
    const { rootDomain, businessType: currentVertical, isApexDomain, isRedirectableRootDomain: onVerticalRoot } =
      classifyHost(hostname, process.env.APP_DOMAIN ?? process.env.NEXT_PUBLIC_APP_DOMAIN)
    const resolvedSlug = reqHeaders.get('x-tenant-slug')
    const resolvedBusinessType = reqHeaders.get('x-tenant-business-type')

    // Super-admin impersonation must NOT redirect to the tenant subdomain
    // — Supabase auth and impersonation cookies are host-scoped to the
    // platform domain. Redirecting would drop the session and bounce to
    // /login. Admin browses the impersonated tenant on the platform URL.
    const isImpersonating = reqHeaders.get('x-admin-impersonating') === 'true'

    // The DNS/domain cutover to hostels.<domain>/hotels.<domain> hasn't
    // happened yet — the platform is still reachable only at its single
    // legacy root domain, with every tenant on a flat {slug}.<domain>
    // subdomain. Until NEXT_PUBLIC_VERTICAL_DOMAINS_ENABLED is flipped on
    // (post-cutover), redirect from the bare apex exactly as before
    // (destination is the flat host); once enabled, only redirect from a
    // bare vertical root that matches the tenant's own vertical, to their
    // {slug}.<vertical>.<domain> host.
    const verticalDomainsLive = process.env.NEXT_PUBLIC_VERTICAL_DOMAINS_ENABLED === 'true'
    const shouldRedirect = verticalDomainsLive
      ? onVerticalRoot && currentVertical === resolvedBusinessType
      : isApexDomain

    if (
      user && resolvedSlug && shouldRedirect &&
      !isAuthPath && !isPortalPath &&
      !pathname.startsWith('/onboarding') &&
      !pathname.startsWith('/admin') &&
      !pathname.startsWith('/api/') &&
      !isImpersonating
    ) {
      // Prefer the tenant's custom domain over the slug-based subdomain
      const resolvedDomain = reqHeaders.get('x-tenant-domain')
      const host = verticalDomainsLive && resolvedBusinessType
        ? tenantHost(resolvedSlug, resolvedBusinessType as BusinessType, rootDomain)
        : `${resolvedSlug}.${rootDomain}`
      const dest = resolvedDomain
        ? `https://${resolvedDomain}${pathname}${request.nextUrl.search}`
        : `https://${host}${pathname}${request.nextUrl.search}`
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
  h.set('x-tenant-id',     tenant.id)
  h.set('x-tenant-slug',   tenant.slug)
  h.set('x-tenant-name',   tenant.name)
  h.set('x-tenant-status', tenant.status)
  h.set('x-tenant-business-type', tenant.businessType)
  if (tenant.branding.primaryColor) h.set('x-tenant-color',   tenant.branding.primaryColor)
  else h.delete('x-tenant-color')
  if (tenant.branding.logoUrl)      h.set('x-tenant-logo',    tenant.branding.logoUrl)
  else h.delete('x-tenant-logo')
  if (tenant.branding.faviconUrl)   h.set('x-tenant-favicon', tenant.branding.faviconUrl)
  else h.delete('x-tenant-favicon')
  if (tenant.domain)                h.set('x-tenant-domain',  tenant.domain)
  else h.delete('x-tenant-domain')
}

function decodeJwtPayload(token: string): Record<string, string> | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    return JSON.parse(Buffer.from(part, 'base64').toString('utf8'))
  } catch { return null }
}

function isAppDomain(hostname: string): boolean {
  // True for any platform-level host with no tenant of its own: the apex
  // marketing site, either bare vertical root (hostels.<domain>/
  // hotels.<domain>), the fixed mobile host, or local dev.
  const c = classifyHost(hostname, process.env.APP_DOMAIN ?? process.env.NEXT_PUBLIC_APP_DOMAIN)
  return c.isLocalDev || c.isFixedAppHost || c.isApexDomain || c.isRedirectableRootDomain
}

interface TenantWithRole {
  tenant: import('@/lib/tenant/resolve').TenantRecord
  role:   string
}

async function fetchTenantForUser(userId: string): Promise<TenantWithRole | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const url = `${supabaseUrl}/rest/v1/tenant_members?user_id=eq.${userId}&is_active=eq.true&select=role,tenants(id,slug,name,plan,is_active,status,business_type,primary_color,logo_url,custom_domain)&limit=1`

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
        id: t.id, slug: t.slug, name: t.name, domain: t.custom_domain ?? null, plan: t.plan,
        isActive: t.is_active, status: t.status, businessType: t.business_type,
        branding: { primaryColor: t.primary_color ?? null, logoUrl: t.logo_url ?? null, faviconUrl: null },
      },
    }
  } catch {
    return null
  }
}

interface TenantBranding {
  primaryColor:  string | null
  logoUrl:       string | null
  faviconUrl:    string | null
  customDomain:  string | null
  status:        string
  businessType:  BusinessType
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
  const url = `${supabaseUrl}/rest/v1/occupants?user_id=eq.${userId}&select=tenant_id,tenants(id,slug,name,plan,is_active,status,business_type,primary_color,logo_url,favicon_url,custom_domain)&limit=1`
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
      id: t.id, slug: t.slug, name: t.name, domain: t.custom_domain ?? null, plan: t.plan,
      isActive: t.is_active, status: t.status, businessType: t.business_type,
      branding: { primaryColor: t.primary_color ?? null, logoUrl: t.logo_url ?? null, faviconUrl: t.favicon_url ?? null },
    }
  } catch { return null }
}

async function fetchBrandingForTenant(tenantId: string): Promise<TenantBranding | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const url = `${supabaseUrl}/rest/v1/tenants?id=eq.${tenantId}&select=primary_color,logo_url,favicon_url,custom_domain,status,business_type&limit=1`
  try {
    const res = await fetch(url, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const rows = await res.json()
    if (!Array.isArray(rows) || rows.length === 0) return null
    return {
      primaryColor: rows[0].primary_color  ?? null,
      logoUrl:      rows[0].logo_url       ?? null,
      faviconUrl:   rows[0].favicon_url    ?? null,
      customDomain: rows[0].custom_domain  ?? null,
      status:       rows[0].status,
      businessType: rows[0].business_type,
    }
  } catch { return null }
}

/** Active role in the tenant; null when not a member, undefined when the
 *  lookup itself failed (the membership guard fails closed on both). */
async function fetchRoleForUser(userId: string, tenantId: string): Promise<string | null | undefined> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const url = `${supabaseUrl}/rest/v1/tenant_members?user_id=eq.${encodeURIComponent(userId)}&tenant_id=eq.${encodeURIComponent(tenantId)}&is_active=eq.true&select=role&limit=1`
  try {
    const res = await fetch(url, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      cache: 'no-store',
    })
    if (!res.ok) return undefined
    const rows = await res.json()
    return rows?.[0]?.role ?? null
  } catch { return undefined }
}

/** Whether the user is a resident (occupants row) of this specific tenant;
 *  undefined when the lookup failed. */
async function checkIsOccupantOfTenant(userId: string, tenantId: string): Promise<boolean | undefined> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const url = `${supabaseUrl}/rest/v1/occupants?user_id=eq.${encodeURIComponent(userId)}&tenant_id=eq.${encodeURIComponent(tenantId)}&select=id&limit=1`
  try {
    const res = await fetch(url, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      cache: 'no-store',
    })
    if (!res.ok) return undefined
    const rows = await res.json()
    return Array.isArray(rows) && rows.length > 0
  } catch { return undefined }
}

/** 403 for a signed-in user with no role in this tenant. The page offers
 *  sign-out (POST /api/auth/signout is exempt from the guard) rather than a
 *  redirect to /login, which would bounce a signed-in user straight back. */
function denyTenantAccess(isApi: boolean): NextResponse {
  if (isApi) return NextResponse.json({ error: 'You do not have access to this property.' }, { status: 403 })
  return new NextResponse(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>No access</title></head>' +
    '<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#173B42">' +
    '<h1 style="font-size:1.4rem">You don\'t have access to this property</h1>' +
    '<p>The account you are signed in with is not a member of this property\'s team.</p>' +
    '<form method="post" action="/api/auth/signout"><button type="submit" style="font:inherit;padding:.6rem 1.1rem;border-radius:999px;border:0;background:#173B42;color:#F7F2E9;cursor:pointer">Sign out and use another account</button></form>' +
    '</body></html>',
    { status: 403, headers: { 'content-type': 'text/html; charset=utf-8' } },
  )
}

/** Removes one cookie from the Cookie header forwarded downstream. */
function stripRequestCookie(headers: Headers, name: string) {
  const cookie = headers.get('cookie')
  if (!cookie) return
  const kept = cookie.split(';').filter((c) => c.split('=')[0].trim() !== name)
  if (kept.length) headers.set('cookie', kept.join(';'))
  else headers.delete('cookie')
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|mp4|webm|woff|woff2|ttf|eot)$).*)'],
}
