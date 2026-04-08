import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

import { resolveTenant } from '@/lib/tenant/resolve'

const PUBLIC_PATHS = [
  '/widget',
  '/api/webhooks',
  '/api/public',
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
]

const AUTH_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password', '/invite']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') ?? ''

  // ── Pass through public / static paths ───────────────────────────────────
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // ── Tenant resolution ─────────────────────────────────────────────────────
  const tenant = await resolveTenant(hostname)

  // Unknown domain → 404
  if (!tenant && !isAppDomain(hostname)) {
    return new NextResponse('Hostel not found', { status: 404 })
  }

  // Inactive tenant → maintenance page
  if (tenant && !tenant.isActive) {
    return NextResponse.rewrite(new URL('/maintenance', request.url))
  }

  // ── Supabase auth session refresh ─────────────────────────────────────────
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Auth guard ────────────────────────────────────────────────────────────
  const isAuthPath = AUTH_PATHS.some((p) => pathname.startsWith(p))

  if (!user && !isAuthPath && pathname !== '/') {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && isAuthPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // ── Inject tenant context into headers (read in Server Components) ────────
  if (tenant) {
    response.headers.set('x-tenant-id', tenant.id)
    response.headers.set('x-tenant-slug', tenant.slug)
    response.headers.set('x-tenant-name', tenant.name)
    if (tenant.branding.primaryColor) {
      response.headers.set('x-tenant-color', tenant.branding.primaryColor)
    }
  } else if (user) {
    // On localhost (or any app domain) tenant resolution returns null.
    // Fall back to JWT claims so API routes and server components work in dev.
    const { data: { session } } = await supabase.auth.getSession()
    const claims = session?.access_token ? decodeJwtPayload(session.access_token) : null
    if (claims?.tenant_id) {
      response.headers.set('x-tenant-id',   claims.tenant_id)
      response.headers.set('x-tenant-slug',  claims.tenant_slug ?? '')
      response.headers.set('x-tenant-name',  claims.tenant_name ?? '')
    }
  }

  return response
}

function decodeJwtPayload(token: string): Record<string, string> | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    return JSON.parse(Buffer.from(part, 'base64').toString('utf8'))
  } catch {
    return null
  }
}

function isAppDomain(hostname: string): boolean {
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'abrempong.com'
  const h = hostname.split(':')[0].toLowerCase()
  return h === appDomain || h === `app.${appDomain}` || h === 'localhost'
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico, robots.txt, sitemap.xml (SEO files)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)',
  ],
}
