/**
 * Authorization regression tests for middleware.ts, run against the real
 * middleware with Supabase auth, the tenant resolver and Supabase REST
 * stubbed out (no network, no real accounts).
 *
 * Covers the holes fixed in fix(security): enforce exact public route
 * matching and protected route authorization —
 * - /bookings and /visitors matched the public '/book' and '/visit' entries
 *   by prefix and skipped the signed-in checks entirely;
 * - on a tenant's subdomain, x-tenant-id came from the hostname with no
 *   check that the signed-in user belonged to that tenant, so another
 *   property's owner or staff, a resident or any new signup could read its
 *   dashboard (and the JWT's role from their own tenant was applied).
 */
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const OWN = 'a0000000-0000-4000-8000-00000000000a'
const VICTIM = 'b0000000-0000-4000-8000-00000000000b'
const ID = {
  ownerOwn: 'u0000000-0000-4000-8000-0000000000a1',
  staffOwn: 'u0000000-0000-4000-8000-0000000000a2',
  residentOwn: 'u0000000-0000-4000-8000-0000000000a3',
  newSignup: 'u0000000-0000-4000-8000-0000000000c1',
  ownerVictim: 'u0000000-0000-4000-8000-0000000000b1',
  platformAdmin: 'u0000000-0000-4000-8000-0000000000d1',
}

type Persona = keyof typeof ID
const CLAIMS: Record<Persona, Record<string, string>> = {
  ownerOwn: { tenant_id: OWN, tenant_slug: 'own', tenant_name: 'Own Hostel', tenant_role: 'owner', portal_role: 'admin' },
  staffOwn: { tenant_id: OWN, tenant_slug: 'own', tenant_name: 'Own Hostel', tenant_role: 'receptionist', portal_role: 'staff' },
  residentOwn: { tenant_id: OWN, portal_role: 'occupant', occupant_id: 'o1' },
  newSignup: {},
  ownerVictim: { tenant_id: VICTIM, tenant_slug: 'victim', tenant_name: 'Victim Hostel', tenant_role: 'owner', portal_role: 'admin' },
  platformAdmin: {},
}

const tenantRecord = (id: string, slug: string, name: string) => ({
  id, slug, name, domain: null, plan: 'growth' as const, isActive: true, status: 'active' as const,
  businessType: 'hostel' as const, branding: { primaryColor: null, logoUrl: null, faviconUrl: null },
})
const TENANT_BY_HOST: Record<string, ReturnType<typeof tenantRecord>> = {
  'own.beddilo.test': tenantRecord(OWN, 'own', 'Own Hostel'),
  'victim.beddilo.test': tenantRecord(VICTIM, 'victim', 'Victim Hostel'),
}

// Supabase REST rows the middleware looks up with the service key.
const DB = {
  tenant_members: [
    { user_id: ID.ownerOwn, tenant_id: OWN, role: 'owner', is_active: true },
    { user_id: ID.staffOwn, tenant_id: OWN, role: 'receptionist', is_active: true },
    { user_id: ID.ownerVictim, tenant_id: VICTIM, role: 'owner', is_active: true },
  ],
  occupants: [{ id: 'o1', user_id: ID.residentOwn, tenant_id: OWN }],
  platform_admins: [{ id: 'p1', user_id: ID.platformAdmin }],
}

let current: Persona | null = null
let restFails = false

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: current ? { id: ID[current], user_metadata: {} } : null } }),
      getSession: async () => ({
        data: { session: current ? { access_token: `x.${Buffer.from(JSON.stringify(CLAIMS[current])).toString('base64')}.y` } : null },
      }),
    },
  }),
}))

vi.mock('@/lib/tenant/resolve', () => ({
  resolveTenant: async (host: string) => TENANT_BY_HOST[host.split(':')[0]] ?? null,
  resolveTenantBySlug: async (slug: string) => Object.values(TENANT_BY_HOST).find((t) => t.slug === slug) ?? null,
}))

function restStub(input: string | URL | Request) {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  const table = url.pathname.replace('/rest/v1/', '')
  if (restFails && table !== 'tenants') return new Response('boom', { status: 500 })
  if (table === 'tenants') return Response.json([{ status: 'active', business_type: 'hostel' }])
  let rows: Record<string, unknown>[] = (DB as Record<string, Record<string, unknown>[]>)[table] ?? []
  for (const [key, value] of url.searchParams) {
    const m = /^eq\.(.*)$/.exec(value)
    if (m) rows = rows.filter((r) => String(r[key]) === m[1])
  }
  const select = url.searchParams.get('select') ?? ''
  if (select.includes('tenants(')) {
    rows = rows.map((r) => ({ ...r, tenants: Object.values(TENANT_BY_HOST).map((t) => ({ id: t.id, slug: t.slug, name: t.name, plan: t.plan, is_active: true, status: 'active', business_type: 'hostel' })).find((t) => t.id === r.tenant_id) }))
  }
  return Response.json(rows)
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.beddilo.test')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')
  vi.stubEnv('NEXT_PUBLIC_APP_DOMAIN', 'beddilo.test')
  vi.stubEnv('APP_DOMAIN', 'beddilo.test')
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => restStub(input)))
  current = null
  restFails = false
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

async function hit(host: string, path: string, opts: { as?: Persona; method?: string; headers?: Record<string, string>; cookies?: string } = {}) {
  current = opts.as ?? null
  const { middleware } = await import('@/middleware')
  const headers = new Headers({ host, ...opts.headers })
  if (opts.cookies) headers.set('cookie', opts.cookies)
  const res = await middleware(new NextRequest(`https://${host}${path}`, { method: opts.method ?? 'GET', headers }))
  return {
    status: res.status,
    location: res.headers.get('location')?.replace(/^https?:\/\/[^/]+/, '') ?? null,
    forwarded: (name: string) => res.headers.get(`x-middleware-request-${name}`),
    passedThrough: res.headers.get('x-middleware-next') === '1',
    body: () => res.text(),
  }
}

const VICTIM_HOST = 'victim.beddilo.test'
const OWN_HOST = 'own.beddilo.test'

describe('logged-out visitors', () => {
  it.each(['/visitors', '/bookings', '/bookings/calendar', '/bookings/new', '/dashboard', '/rooms/categories'])(
    'are sent to /login from %s before the page renders',
    async (path) => {
      const r = await hit(VICTIM_HOST, path)
      expect(r.status).toBe(307)
      expect(r.location).toBe(`/login?next=${encodeURIComponent(path)}`)
    },
  )

  it.each(['/book', '/book/confirm', '/visit/abc', '/checkin', '/portal/xyz', '/api/public/listings'])(
    'can still open the public %s',
    async (path) => {
      const r = await hit(VICTIM_HOST, path)
      expect(r.passedThrough).toBe(true)
      expect(r.forwarded('x-tenant-id')).toBe(VICTIM)
    },
  )
})

describe('cross-tenant access on another property\'s subdomain', () => {
  it.each<[Persona, string]>([
    ['ownerOwn', '/visitors'],
    ['ownerOwn', '/dashboard'],
    ['ownerOwn', '/settings/payouts'],
    ['staffOwn', '/rooms/categories'],
    ['residentOwn', '/visitors'],
    ['newSignup', '/visitors'],
    ['newSignup', '/onboarding'],
  ])('%s is refused on %s', async (persona, path) => {
    const r = await hit(VICTIM_HOST, path, { as: persona })
    expect(r.status).toBe(403)
    expect(r.passedThrough).toBe(false)
    expect(await r.body()).toContain('Sign out')
  })

  it('refuses tenant APIs with a JSON 403', async () => {
    const r = await hit(VICTIM_HOST, '/api/rooms', { as: 'ownerOwn' })
    expect(r.status).toBe(403)
    expect(await r.body()).toContain('do not have access')
  })

  it('never applies the role from the user\'s own tenant to another tenant', async () => {
    const r = await hit(VICTIM_HOST, '/dashboard', { as: 'ownerOwn' })
    expect(r.passedThrough).toBe(false)
    expect(r.forwarded('x-tenant-role')).toBeNull()
  })

  it('still lets a refused user sign out', async () => {
    const r = await hit(VICTIM_HOST, '/api/auth/signout', { as: 'newSignup', method: 'POST' })
    expect(r.passedThrough).toBe(true)
  })

  it('still serves public pages to someone signed in elsewhere', async () => {
    const r = await hit(VICTIM_HOST, '/book', { as: 'ownerOwn' })
    expect(r.passedThrough).toBe(true)
  })
})

describe('residents', () => {
  it.each(['/visitors', '/bookings', '/food/orders', '/revenue-points', '/shift-closeout', '/rooms/categories'])(
    'are sent to their portal from the staff page %s',
    async (path) => {
      const r = await hit(OWN_HOST, path, { as: 'residentOwn' })
      expect(r.status).toBe(307)
      expect(r.location).toBe('/occupant-portal')
    },
  )

  it.each(['/occupant-portal', '/occupant-portal/profile', '/api/occupant/profile', '/api/messages/conversations', '/api/push/register', '/auth/set-password'])(
    'keep %s',
    async (path) => {
      const r = await hit(OWN_HOST, path, { as: 'residentOwn' })
      expect(r.passedThrough).toBe(true)
      expect(r.forwarded('x-tenant-id')).toBe(OWN)
    },
  )

  // Most staff APIs have no role check of their own; before this a resident
  // could rename the property, add room types or change its payout account.
  it.each(['/api/rooms', '/api/room-categories', '/api/settings/profile', '/api/settings/payouts/subaccount', '/api/accounting/journal', '/api/occupants', '/api/occupantsx'])(
    'are refused the staff API %s',
    async (path) => {
      const r = await hit(OWN_HOST, path, { as: 'residentOwn', method: 'POST' })
      expect(r.status).toBe(403)
      expect(await r.body()).toContain('do not have access')
    },
  )
})

describe('staff and owners of the property', () => {
  it('staff reach the dashboard with their real role', async () => {
    const r = await hit(OWN_HOST, '/visitors', { as: 'staffOwn' })
    expect(r.passedThrough).toBe(true)
    expect(r.forwarded('x-tenant-id')).toBe(OWN)
    expect(r.forwarded('x-tenant-role')).toBe('receptionist')
  })

  it.each(['/settings', '/staff', '/staff/performance'])('staff are still kept out of the admin-only %s', async (path) => {
    const r = await hit(OWN_HOST, path, { as: 'staffOwn' })
    expect(r.status).toBe(307)
    expect(r.location).toBe('/dashboard')
  })

  // The mobile app sends every non-owner role to /staff-mobile; the '/staff'
  // admin-only prefix used to catch it and bounce them to /dashboard.
  it('staff reach the mobile staff home', async () => {
    const r = await hit(OWN_HOST, '/staff-mobile/tasks', { as: 'staffOwn' })
    expect(r.passedThrough).toBe(true)
    expect(r.forwarded('x-tenant-role')).toBe('receptionist')
  })

  it.each(['/dashboard', '/bookings', '/visitors', '/settings/payouts', '/api/rooms'])('owners reach %s', async (path) => {
    const r = await hit(OWN_HOST, path, { as: 'ownerOwn' })
    expect(r.passedThrough).toBe(true)
    expect(r.forwarded('x-tenant-role')).toBe('owner')
  })

  it('the victim property\'s own owner is unaffected', async () => {
    const r = await hit(VICTIM_HOST, '/visitors', { as: 'ownerVictim' })
    expect(r.passedThrough).toBe(true)
    expect(r.forwarded('x-tenant-id')).toBe(VICTIM)
  })
})

describe('fail-closed and impersonation', () => {
  it('returns 503 instead of granting access when the membership lookup fails', async () => {
    restFails = true
    const page = await hit(OWN_HOST, '/visitors', { as: 'ownerOwn' })
    expect(page.status).toBe(503)
    const api = await hit(OWN_HOST, '/api/rooms', { as: 'ownerOwn' })
    expect(api.status).toBe(503)
  })

  it('lets a verified platform admin impersonate a tenant', async () => {
    const r = await hit('beddilo.test', '/dashboard', {
      as: 'platformAdmin',
      cookies: `x-admin-impersonate-tenant=${VICTIM}; x-admin-impersonate-slug=victim`,
    })
    expect(r.passedThrough).toBe(true)
    expect(r.forwarded('x-tenant-id')).toBe(VICTIM)
    expect(r.forwarded('x-admin-impersonating')).toBe('true')
  })

  it('ignores impersonation cookies from someone who is not a platform admin', async () => {
    const r = await hit(VICTIM_HOST, '/dashboard', {
      as: 'newSignup',
      cookies: `x-admin-impersonate-tenant=${VICTIM}; x-admin-impersonate-slug=victim`,
    })
    expect(r.status).toBe(403)
  })

  it('strips a client-supplied x-tenant-id', async () => {
    const r = await hit('beddilo.test', '/dashboard', { as: 'newSignup', headers: { 'x-tenant-id': VICTIM, 'x-tenant-role': 'owner' } })
    expect(r.forwarded('x-tenant-id')).toBeNull()
    expect(r.forwarded('x-tenant-role')).toBeNull()
  })
})

// getServerTenantId() falls back to the __tenant_id cookie when there is no
// x-tenant-id header — which is the case for an account with no property on
// the root domain, so a forged cookie used to pick the tenant API writes went to.
describe('forged tenant cookie', () => {
  it('is not forwarded for an account with no property', async () => {
    const r = await hit('beddilo.test', '/api/room-categories', { as: 'newSignup', method: 'POST', cookies: `a=1; __tenant_id=${VICTIM}; b=2` })
    expect(r.passedThrough).toBe(true)
    expect(r.forwarded('x-tenant-id')).toBeNull()
    expect(r.forwarded('cookie')).toBe('a=1; b=2')
  })

  it('is not forwarded to logged-out public pages either', async () => {
    const r = await hit('beddilo.test', '/book', { cookies: `__tenant_id=${VICTIM}` })
    expect(r.passedThrough).toBe(true)
    expect(r.forwarded('cookie')).toBeNull()
  })

  it('cannot override the tenant a member was resolved to', async () => {
    const r = await hit(OWN_HOST, '/api/room-categories', { as: 'ownerOwn', method: 'POST', cookies: `__tenant_id=${VICTIM}` })
    expect(r.forwarded('x-tenant-id')).toBe(OWN)
    expect(r.forwarded('cookie') ?? '').not.toContain(VICTIM)
  })
})
