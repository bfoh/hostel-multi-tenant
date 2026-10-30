/**
 * Authorization regression tests for /api/onboarding/identity and
 * /api/onboarding/complete. Both accept a tenantId in the request body (the
 * wizard sends it after self-provisioning) and write with the service-role
 * client; before the fix neither checked that the caller belonged to that
 * tenant, so any signed-in account could rename another property, take its
 * URL slug and add room types to it. Supabase, next/headers and email are
 * mocked — no network, no real accounts.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const OWN = 'a0000000-0000-4000-8000-00000000000a'
const VICTIM = 'b0000000-0000-4000-8000-00000000000b'
const USER = 'u0000000-0000-4000-8000-0000000000c1'

let signedIn = true
let headerTenantId: string | null = null
let memberships: { tenant_id: string; user_id: string; is_active: boolean }[] = []
let writes: { table: string; op: string; filters: unknown[][] }[] = []

vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => (k === 'x-tenant-id' ? headerTenantId : null) }),
  cookies: async () => ({ get: () => undefined }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: USER, user_metadata: {} } : null } }) },
  }),
}))

vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(async () => undefined), newTenantLeadHtml: () => '' }))
vi.mock('@/lib/tenant/resolve', () => ({ invalidateTenantCache: vi.fn(async () => undefined) }))

// Chainable stand-in for the supabase-js query builder: records filters and
// writes, and answers tenant_members lookups from `memberships`.
function query(table: string) {
  const filters: unknown[][] = []
  let op = 'select'
  const result = () => {
    if (table === 'tenant_members') {
      const eq = Object.fromEntries(filters.filter((f) => f[0] === 'eq').map((f) => [f[1], f[2]]))
      const row = memberships.find((m) =>
        (eq.user_id === undefined || m.user_id === eq.user_id) &&
        (eq.tenant_id === undefined || m.tenant_id === eq.tenant_id) &&
        (eq.is_active === undefined || m.is_active === eq.is_active))
      return { data: row ? { id: 'm1', tenant_id: row.tenant_id } : null, error: null }
    }
    if (table === 'tenants' && op === 'select') {
      const byId = filters.some((f) => f[0] === 'eq' && f[1] === 'id')
      return { data: byId ? { slug: 'own', custom_domain: null, business_type: 'hostel' } : null, error: null }
    }
    return { data: { id: 'new-row' }, error: null }
  }
  const builder: any = new Proxy({}, {
    get(_, prop: string) {
      if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(result())
      if (prop === 'maybeSingle' || prop === 'single') return async () => result()
      return (...args: unknown[]) => {
        if (['update', 'insert', 'upsert', 'delete'].includes(prop)) {
          op = prop
          writes.push({ table, op: prop, filters })
        } else {
          filters.push([prop, ...args])
        }
        return builder
      }
    },
  })
  return builder
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: (t: string) => query(t) }) }))

const identityBody = { tenantId: VICTIM, name: 'Renamed Property', slug: 'renamed-property' }
const completeBody = {
  ...identityBody, category_name: 'Single', category_type: 'single', base_rate: 100000,
  rate_unit: 'semester', capacity: 1, room_number: '1',
}

async function post(route: 'identity' | 'complete', body: Record<string, unknown>) {
  const mod = route === 'identity'
    ? await import('@/app/api/onboarding/identity/route')
    : await import('@/app/api/onboarding/complete/route')
  const req = new NextRequest(`https://beddilo.test/api/onboarding/${route}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  return mod.POST(req)
}

beforeEach(() => {
  signedIn = true
  headerTenantId = null
  memberships = [{ tenant_id: OWN, user_id: USER, is_active: true }]
  writes = []
})

describe.each(['identity', 'complete'] as const)('/api/onboarding/%s', (route) => {
  const body = route === 'identity' ? identityBody : completeBody

  it("refuses another tenant's id in the body and writes nothing", async () => {
    const res = await post(route, body)
    expect(res.status).toBe(403)
    expect(writes).toEqual([])
  })

  it('refuses a signed-in user with no tenant at all', async () => {
    memberships = []
    const res = await post(route, body)
    expect(res.status).toBe(403)
    expect(writes).toEqual([])
  })

  it('refuses an inactive membership', async () => {
    memberships = [{ tenant_id: VICTIM, user_id: USER, is_active: false }]
    const res = await post(route, body)
    expect(res.status).toBe(403)
    expect(writes).toEqual([])
  })

  it('requires a signed-in user', async () => {
    signedIn = false
    const res = await post(route, body)
    expect(res.status).toBe(401)
    expect(writes).toEqual([])
  })

  it("updates the caller's own tenant when they are a member", async () => {
    const res = await post(route, { ...body, tenantId: OWN })
    expect(res.status).toBe(200)
    const tenantUpdate = writes.find((w) => w.table === 'tenants' && w.op === 'update')
    expect(tenantUpdate).toBeDefined()
  })

  it("falls back to the caller's own membership when no tenant id is sent", async () => {
    const { tenantId: _omit, ...withoutTenant } = body
    const res = await post(route, withoutTenant)
    expect(res.status).toBe(200)
  })
})
