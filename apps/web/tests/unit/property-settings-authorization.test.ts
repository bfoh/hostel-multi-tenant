/**
 * Authorization regression tests for the APIs that change what a property
 * is: its name, custom domain, payout bank account and room types. They
 * write with the service-role client and used to rely on middleware alone,
 * which only checks that the caller belongs to the property — so a
 * receptionist or housekeeper could rename it, point its domain elsewhere or
 * send its booking money to another bank account. Owner or manager only.
 * Supabase, next/headers and Paystack are mocked — no network, no real
 * accounts.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const OWN = 'a0000000-0000-4000-8000-00000000000a'
const USER = 'u0000000-0000-4000-8000-0000000000c1'

let role: string | null = 'owner'
let writes: { table: string; op: string }[] = []

vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => (k === 'x-tenant-id' ? OWN : null) }),
  cookies: async () => ({ get: () => undefined }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: USER } } }) } }),
}))

vi.mock('@/lib/tenant/resolve', () => ({ invalidateTenantCache: vi.fn(async () => undefined) }))

const paystack = {
  createSubaccount: vi.fn(async () => ({ subaccount_code: 'ACCT_x' })),
  updateSubaccount: vi.fn(async () => ({ subaccount_code: 'ACCT_x' })),
  fetchSubaccount: vi.fn(async () => ({ active: true })),
}
vi.mock('@/lib/paystack', () => paystack)

// Chainable stand-in for the supabase-js query builder that records writes.
// A .neq() lookup is a "does another property already use this?" check.
function query(table: string) {
  let otherTenant = false
  const result = () => {
    if (table === 'tenant_members') return { data: role ? { role, is_active: true } : null, error: null }
    if (table === 'tenants' && !otherTenant) return { data: { id: OWN, name: 'Own Hostel', custom_domain: null, paystack_subaccount_code: null }, error: null }
    if (table === 'tenants') return { data: null, error: null }
    return { data: { id: 'row' }, error: null, count: 0 }
  }
  const builder: any = new Proxy({}, {
    get(_, prop: string) {
      if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(result())
      if (prop === 'maybeSingle' || prop === 'single') return async () => result()
      return () => {
        if (prop === 'neq') otherTenant = true
        if (['update', 'insert', 'upsert', 'delete'].includes(prop)) writes.push({ table, op: prop })
        return builder
      }
    },
  })
  return builder
}
const client = { from: (t: string) => query(t) }
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => client }))
vi.mock('@/lib/supabase/tenant-admin', () => ({ createTenantAdminClientFromHeaders: async () => client }))

const params = { params: Promise.resolve({ id: 'c0000000-0000-4000-8000-0000000000c1' }) }
const req = (method: string, body?: unknown) =>
  new NextRequest('https://own.beddilo.test/api/x', {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  })

const CASES: [string, () => Promise<Response>][] = [
  ['PATCH /api/settings/profile (rename)', async () =>
    (await import('@/app/api/settings/profile/route')).PATCH(req('PATCH', { name: 'Renamed Property' }))],
  ['PATCH /api/settings/domain', async () =>
    (await import('@/app/api/settings/domain/route')).PATCH(req('PATCH', { custom_domain: 'example.com' }))],
  ['GET /api/settings/payouts/subaccount (bank details)', async () =>
    (await import('@/app/api/settings/payouts/subaccount/route')).GET()],
  ['POST /api/settings/payouts/subaccount (bank account)', async () =>
    (await import('@/app/api/settings/payouts/subaccount/route')).POST(req('POST', {
      bank_code: '058', account_number: '0123456789', account_name: 'Someone Else', settlement_bank: 'Bank',
    }))],
  ['POST /api/room-categories', async () =>
    (await import('@/app/api/room-categories/route')).POST(req('POST', {
      name: 'Single', type: 'single', base_rate: 100, rate_unit: 'month', capacity: 1,
    }))],
  ['PUT /api/room-categories/[id]', async () =>
    (await import('@/app/api/room-categories/[id]/route')).PUT(req('PUT', { base_rate: 1 }), params)],
  ['DELETE /api/room-categories/[id]', async () =>
    (await import('@/app/api/room-categories/[id]/route')).DELETE(req('DELETE'), params)],
]

beforeEach(() => {
  role = 'owner'
  writes = []
  Object.values(paystack).forEach((fn) => fn.mockClear())
})

describe.each(CASES)('%s', (_label, call) => {
  it.each(['receptionist', 'housekeeper', 'accountant', 'security'])('refuses a %s and changes nothing', async (r) => {
    role = r
    const res = await call()
    expect(res.status).toBe(403)
    expect(writes).toEqual([])
    expect(paystack.createSubaccount).not.toHaveBeenCalled()
    expect(paystack.updateSubaccount).not.toHaveBeenCalled()
  })

  it('refuses someone who is not on the team', async () => {
    role = null
    const res = await call()
    expect(res.status).toBe(403)
    expect(writes).toEqual([])
  })

  it.each(['owner', 'manager'])('lets the %s through', async (r) => {
    role = r
    const res = await call()
    expect(res.status).toBeLessThan(400)
  })
})
