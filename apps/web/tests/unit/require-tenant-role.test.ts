/**
 * Unit tests for requireTenantRole() (lib/auth/tenant-role.ts) — specifically
 * the impersonation exception added after discovering it silently 403'd a
 * super-admin impersonation session on every gated API route (no real
 * tenant_members row exists for a platform admin's own user_id under the
 * tenant they're impersonating). next/headers, the Supabase server client,
 * and the admin client are all mocked so this runs with no DB/network.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

let headerMap = new Map<string, string>()
let tenantMemberRow: { role: string; is_active: boolean } | null = null

vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => headerMap.get(k) ?? null }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: tenantMemberRow }),
          }),
        }),
      }),
    }),
  }),
}))

import { requireTenantRole } from '@/lib/auth/tenant-role'

beforeEach(() => {
  headerMap = new Map()
  tenantMemberRow = null
})

describe('requireTenantRole — impersonation', () => {
  it('grants access when impersonating with an allowed x-tenant-role, skipping the DB lookup', async () => {
    headerMap.set('x-admin-impersonating', 'true')
    headerMap.set('x-tenant-role', 'owner')

    const result = await requireTenantRole('tenant-1', ['owner', 'manager'])

    expect(result).toMatchObject({ userId: 'user-1', tenantId: 'tenant-1', role: 'owner' })
  })

  it('denies access when impersonating with a role outside the allowed list', async () => {
    headerMap.set('x-admin-impersonating', 'true')
    headerMap.set('x-tenant-role', 'receptionist')

    const result: any = await requireTenantRole('tenant-1', ['owner', 'manager'])

    expect(result.status).toBe(403)
  })

  it('defaults to owner when impersonating with no x-tenant-role header set', async () => {
    headerMap.set('x-admin-impersonating', 'true')

    const result = await requireTenantRole('tenant-1', ['owner'])

    expect(result).toMatchObject({ role: 'owner' })
  })
})

describe('requireTenantRole — real (non-impersonating) sessions', () => {
  it('still resolves the role from tenant_members when not impersonating', async () => {
    tenantMemberRow = { role: 'manager', is_active: true }

    const result = await requireTenantRole('tenant-1', ['owner', 'manager'])

    expect(result).toMatchObject({ userId: 'user-1', tenantId: 'tenant-1', role: 'manager' })
  })

  it('rejects an inactive or missing tenant_members row', async () => {
    tenantMemberRow = null

    const result: any = await requireTenantRole('tenant-1', ['owner', 'manager'])

    expect(result.status).toBe(403)
  })
})
