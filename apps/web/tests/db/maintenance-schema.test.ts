/**
 * Regression tests for
 * 202400010000135_reconstruct_contractors_and_maintenance_requests.sql —
 * see that migration's header for what's a confirmed fact (column list,
 * cross-referenced against packages/types/src/database.ts and every
 * apps/web call site) versus a reasonable reconstruction with no ground
 * truth to verify against (ref_number generation, RLS policies).
 *
 * These tests lock down the reconstructed behavior itself, not "did we
 * guess right" — there's no way to check the latter without production DB
 * access. If someone reconciles this migration against the real schema
 * later (e.g. via `supabase db diff --linked`), these tests should still
 * pass against whatever the corrected version does.
 */
import { randomUUID } from 'node:crypto'

import type { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { startTestDb, type TestDb } from './harness'

let db: TestDb
let client: Client

async function createTenant(name: string): Promise<string> {
  const id = randomUUID()
  await client.query(
    `insert into tenants (id, name, slug, status) values ($1, $2, $3, 'active')`,
    [id, name, name.toLowerCase().replace(/\s+/g, '-') + '-' + id.slice(0, 8)],
  )
  return id
}

async function createMember(tenantId: string, role: string): Promise<string> {
  const userId = randomUUID()
  await client.query(`insert into auth.users (id) values ($1)`, [userId])
  await client.query(
    `insert into tenant_members (id, tenant_id, user_id, role, is_active) values ($1, $2, $3, $4, true)`,
    [randomUUID(), tenantId, userId, role],
  )
  return userId
}

async function createRequest(tenantId: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const id = randomUUID()
  const fields = { id, tenant_id: tenantId, title: 'Leaking tap', category: 'plumbing', ...overrides }
  const cols = Object.keys(fields)
  const placeholders = cols.map((_, i) => `$${i + 1}`)
  await client.query(
    `insert into maintenance_requests (${cols.join(', ')}) values (${placeholders.join(', ')})`,
    Object.values(fields),
  )
  return id
}

beforeAll(async () => {
  db = await startTestDb()
  client = db.client
}, 60_000)

afterAll(async () => {
  await db.teardown()
})

describe('maintenance_requests.ref_number generation', () => {
  it('auto-generates a sequential, year-scoped ref_number per tenant when none is supplied', async () => {
    const tenantId = await createTenant('Ref Number Tenant')
    const id1 = await createRequest(tenantId)
    const id2 = await createRequest(tenantId)

    const { rows } = await client.query(
      `select id, ref_number from maintenance_requests where id in ($1, $2) order by ref_number`,
      [id1, id2],
    )
    const year = new Date().getFullYear()
    expect(rows[0].ref_number).toBe(`MR-${year}-00001`)
    expect(rows[1].ref_number).toBe(`MR-${year}-00002`)
  })

  it('keeps ref_number sequences independent per tenant', async () => {
    const tenantA = await createTenant('Ref Tenant A')
    const tenantB = await createTenant('Ref Tenant B')
    await createRequest(tenantA)
    const idB = await createRequest(tenantB)

    const { rows } = await client.query(`select ref_number from maintenance_requests where id = $1`, [idB])
    const year = new Date().getFullYear()
    expect(rows[0].ref_number).toBe(`MR-${year}-00001`)
  })

  it('leaves a caller-supplied ref_number untouched (the pm-schedule spawn path relies on this)', async () => {
    const tenantId = await createTenant('Explicit Ref Tenant')
    const id = await createRequest(tenantId, { ref_number: 'MR-PM-CUSTOM123' })

    const { rows } = await client.query(`select ref_number from maintenance_requests where id = $1`, [id])
    expect(rows[0].ref_number).toBe('MR-PM-CUSTOM123')
  })
})

describe('maintenance_requests.updated_at trigger', () => {
  it('bumps updated_at on UPDATE', async () => {
    const tenantId = await createTenant('Updated At Tenant')
    const id = await createRequest(tenantId)
    const before = (await client.query(`select updated_at from maintenance_requests where id = $1`, [id])).rows[0]
      .updated_at

    await new Promise((r) => setTimeout(r, 10))
    await client.query(`update maintenance_requests set notes = 'checked' where id = $1`, [id])

    const after = (await client.query(`select updated_at from maintenance_requests where id = $1`, [id])).rows[0]
      .updated_at
    expect(new Date(after).getTime()).toBeGreaterThan(new Date(before).getTime())
  })
})

describe('reconstructed RLS: contractors', () => {
  it('does not let a tenant B member read tenant A\'s contractors', async () => {
    const tenantA = await createTenant('Contractor Tenant A')
    const tenantB = await createTenant('Contractor Tenant B')
    await createMember(tenantA, 'owner')
    const userB = await createMember(tenantB, 'owner')

    await client.query(
      `insert into contractors (id, tenant_id, name, phone) values ($1, $2, 'Kofi Electricals', '0244000000')`,
      [randomUUID(), tenantA],
    )

    await db.asUser({ sub: userB, role: 'authenticated' }, async (c) => {
      const res = await c.query(`select * from contractors where tenant_id = $1`, [tenantA])
      expect(res.rowCount).toBe(0)
    })
  })

  it('lets a tenant member read and manage their own tenant\'s contractors', async () => {
    const tenantId = await createTenant('Contractor Own Tenant')
    const ownerId = await createMember(tenantId, 'owner')

    await db.asUser(
      { sub: ownerId, role: 'authenticated', tenant_id: tenantId, tenant_role: 'owner' },
      async (c) => {
        await c.query(
          `insert into contractors (id, tenant_id, name, phone) values ($1, $2, 'Ama Plumbing', '0201234567')`,
          [randomUUID(), tenantId],
        )
      },
      { commit: true },
    )

    const { rowCount } = await client.query(`select 1 from contractors where tenant_id = $1`, [tenantId])
    expect(rowCount).toBe(1)
  })
})

describe('reconstructed RLS: maintenance_requests update/delete', () => {
  it('does not let a tenant B member update tenant A\'s request', async () => {
    const tenantA = await createTenant('MR Tenant A')
    const tenantB = await createTenant('MR Tenant B')
    await createMember(tenantA, 'owner')
    const userB = await createMember(tenantB, 'owner')
    const requestId = await createRequest(tenantA)

    await db.asUser({ sub: userB, role: 'authenticated' }, async (c) => {
      const res = await c.query(`update maintenance_requests set status = 'cancelled' where id = $1`, [requestId])
      expect(res.rowCount).toBe(0)
    })

    const { rows } = await client.query(`select status from maintenance_requests where id = $1`, [requestId])
    expect(rows[0].status).toBe('open')
  })

  it('lets an owner in the same tenant update the request', async () => {
    const tenantId = await createTenant('MR Update Own Tenant')
    const ownerId = await createMember(tenantId, 'owner')
    const requestId = await createRequest(tenantId)

    await db.asUser(
      { sub: ownerId, role: 'authenticated', tenant_id: tenantId, tenant_role: 'owner' },
      async (c) => {
        await c.query(`update maintenance_requests set status = 'in_progress' where id = $1`, [requestId])
      },
      { commit: true },
    )

    const { rows } = await client.query(`select status from maintenance_requests where id = $1`, [requestId])
    expect(rows[0].status).toBe('in_progress')
  })

  it('only lets owner/manager delete a request, not other staff roles', async () => {
    const tenantId = await createTenant('MR Delete Tenant')
    const housekeeperId = await createMember(tenantId, 'housekeeper')
    const requestId = await createRequest(tenantId)

    await db.asUser({ sub: housekeeperId, role: 'authenticated' }, async (c) => {
      const res = await c.query(`delete from maintenance_requests where id = $1`, [requestId])
      expect(res.rowCount).toBe(0)
    })

    const { rowCount } = await client.query(`select 1 from maintenance_requests where id = $1`, [requestId])
    expect(rowCount).toBe(1)
  })
})
