/**
 * Unit tests for the createTenantAdminClient Proxy wrapper
 * (lib/supabase/tenant-admin.ts) — the mechanism that auto-scopes every
 * admin-client query by tenant_id so a developer can't accidentally leak
 * rows across tenants by forgetting a .eq('tenant_id', …) filter. This is
 * the core defense the tenant-scoping CI audit (scripts/audit-tenant-scoping.mjs)
 * assumes exists, so it's worth testing directly rather than only through
 * the audit script's text-heuristics.
 *
 * `createAdminClient` is mocked so these run with no network/DB access —
 * only the wrapper's own query-shaping logic is under test.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({
  headers: async () => new Map(),
}))

interface RecordedCall {
  op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' | 'eq'
  args: unknown[]
}

function createFakeQueryBuilder() {
  const calls: RecordedCall[] = []
  const chain: any = {
    eq: (...args: unknown[]) => {
      calls.push({ op: 'eq', args })
      return chain
    },
    single: () => chain,
  }
  const qb: any = {
    select: (...args: unknown[]) => {
      calls.push({ op: 'select', args })
      return chain
    },
    insert: (...args: unknown[]) => {
      calls.push({ op: 'insert', args })
      return chain
    },
    upsert: (...args: unknown[]) => {
      calls.push({ op: 'upsert', args })
      return chain
    },
    update: (...args: unknown[]) => {
      calls.push({ op: 'update', args })
      return chain
    },
    delete: (...args: unknown[]) => {
      calls.push({ op: 'delete', args })
      return chain
    },
  }
  return { qb, calls }
}

const tables: Record<string, ReturnType<typeof createFakeQueryBuilder>> = {}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      tables[table] = tables[table] ?? createFakeQueryBuilder()
      return tables[table].qb
    },
  }),
}))

const { createTenantAdminClient } = await import('@/lib/supabase/tenant-admin')

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key]
})

const TENANT_ID = '11111111-1111-1111-1111-111111111111'

describe('createTenantAdminClient', () => {
  it('auto-appends .eq(tenant_id, …) on select', async () => {
    const client = createTenantAdminClient(TENANT_ID) as any
    client.from('rooms').select('id, name')

    const calls = tables.rooms.calls
    expect(calls[0]).toEqual({ op: 'select', args: ['id, name'] })
    expect(calls[1]).toEqual({ op: 'eq', args: ['tenant_id', TENANT_ID] })
  })

  it('stamps tenant_id onto a single-row insert', async () => {
    const client = createTenantAdminClient(TENANT_ID) as any
    client.from('rooms').insert({ name: 'Room 101' })

    const [{ args }] = tables.rooms.calls
    expect(args[0]).toEqual({ name: 'Room 101', tenant_id: TENANT_ID })
  })

  it('stamps tenant_id onto every row of a bulk insert', async () => {
    const client = createTenantAdminClient(TENANT_ID) as any
    client.from('rooms').insert([{ name: 'A' }, { name: 'B' }])

    const [{ args }] = tables.rooms.calls
    expect(args[0]).toEqual([
      { name: 'A', tenant_id: TENANT_ID },
      { name: 'B', tenant_id: TENANT_ID },
    ])
  })

  it('strips a caller-supplied tenant_id from update() payloads before filtering by the real one', async () => {
    const client = createTenantAdminClient(TENANT_ID) as any
    client.from('rooms').update({ tenant_id: 'some-other-tenant', name: 'Renamed' })

    const calls = tables.rooms.calls
    expect(calls[0]).toEqual({ op: 'update', args: [{ name: 'Renamed' }, undefined] })
    expect(calls[1]).toEqual({ op: 'eq', args: ['tenant_id', TENANT_ID] })
  })

  it('auto-appends .eq(tenant_id, …) on delete', async () => {
    const client = createTenantAdminClient(TENANT_ID) as any
    client.from('rooms').delete()

    const calls = tables.rooms.calls
    expect(calls[1]).toEqual({ op: 'eq', args: ['tenant_id', TENANT_ID] })
  })

  it('does not scope cross-tenant tables like "tenants" or "tenant_members"', async () => {
    const client = createTenantAdminClient(TENANT_ID) as any
    client.from('tenants').select('id')

    const calls = tables.tenants.calls
    expect(calls).toEqual([{ op: 'select', args: ['id'] }])
  })

  it('.fromGlobal() always bypasses tenant scoping, even for a scoped table name', async () => {
    const client = createTenantAdminClient(TENANT_ID) as any
    ;(client as any).fromGlobal('rooms').select('id')

    const calls = tables.rooms.calls
    expect(calls).toEqual([{ op: 'select', args: ['id'] }])
  })

  it('throws rather than silently operating tenant-less when tenantId is empty', () => {
    expect(() => createTenantAdminClient('')).toThrow(/tenantId is required/)
    expect(() => createTenantAdminClient(null)).toThrow(/tenantId is required/)
    expect(() => createTenantAdminClient(undefined)).toThrow(/tenantId is required/)
  })
})
