/**
 * Regression tests for migration 116 (finding #4): the occupants
 * self-select RLS policy was dead code (gated on a JWT claim the auth
 * hook never actually sets for occupant sessions) and, even if it had
 * fired, had no per-row check at all — it would have let any resident
 * read every other resident's PII in the tenant.
 *
 * These confirm the replacement policy actually works for a real occupant
 * session (tenant_id + portal_role claims, as the hook really sets them)
 * and is correctly scoped to the caller's own row.
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

async function createOccupant(tenantId: string, userId: string | null, name: string): Promise<string> {
  const id = randomUUID()
  await client.query(
    `insert into occupants (id, tenant_id, user_id, first_name, last_name, phone)
     values ($1, $2, $3, $4, 'Resident', '0200000000')`,
    [id, tenantId, userId, name],
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

describe('occupants self-select policy (migration 116 fix for finding #4)', () => {
  it('lets an occupant read their own occupant record', async () => {
    const tenantId = await createTenant('Occupant Self Tenant')
    const userId = randomUUID()
    await client.query(`insert into auth.users (id) values ($1)`, [userId])
    const occupantId = await createOccupant(tenantId, userId, 'Ama')

    await db.asUser({ sub: userId, role: 'authenticated', tenant_id: tenantId, portal_role: 'occupant' }, async (c) => {
      const res = await c.query(`select id, first_name from occupants where id = $1`, [occupantId])
      expect(res.rowCount).toBe(1)
      expect(res.rows[0].first_name).toBe('Ama')
    })
  })

  it('does not let an occupant read a different occupant\'s record in the same tenant', async () => {
    const tenantId = await createTenant('Occupant Cross Tenant')
    const userA = randomUUID()
    const userB = randomUUID()
    await client.query(`insert into auth.users (id) values ($1), ($2)`, [userA, userB])
    await createOccupant(tenantId, userA, 'Ama')
    const occupantB = await createOccupant(tenantId, userB, 'Kofi')

    await db.asUser({ sub: userA, role: 'authenticated', tenant_id: tenantId, portal_role: 'occupant' }, async (c) => {
      const res = await c.query(`select id from occupants where id = $1`, [occupantB])
      expect(res.rowCount).toBe(0)
    })
  })

  it('does not let a tenant B occupant read a tenant A occupant\'s record', async () => {
    const tenantA = await createTenant('Occupant Tenant A')
    const tenantB = await createTenant('Occupant Tenant B')
    const userA = randomUUID()
    const userB = randomUUID()
    await client.query(`insert into auth.users (id) values ($1), ($2)`, [userA, userB])
    const occupantA = await createOccupant(tenantA, userA, 'Ama')
    await createOccupant(tenantB, userB, 'Kofi')

    await db.asUser({ sub: userB, role: 'authenticated', tenant_id: tenantB, portal_role: 'occupant' }, async (c) => {
      const res = await c.query(`select id from occupants where id = $1`, [occupantA])
      expect(res.rowCount).toBe(0)
    })
  })
})
