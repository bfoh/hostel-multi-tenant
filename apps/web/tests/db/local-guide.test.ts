/**
 * Integration test for migration 135 (tenant_local_guide_entries) —
 * confirms the category check constraint and the sensible defaults a
 * minimal insert relies on (accommodation_type-style additive column
 * contract: category defaults 'other', sort_order defaults 0).
 */
import { randomUUID } from 'node:crypto'

import type { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { startTestDb, type TestDb } from './harness'

let db: TestDb
let client: Client

async function createTenant(): Promise<string> {
  const id = randomUUID()
  await client.query(`insert into tenants (id, name, slug) values ($1, 'Test Hostel', $2)`, [
    id,
    `test-hostel-${id.slice(0, 8)}`,
  ])
  return id
}

beforeAll(async () => {
  db = await startTestDb({
    extraMigrationFiles: ['20240001000135_tenant_local_guide.sql'],
  })
  client = db.client
}, 60_000)

afterAll(async () => {
  await db.teardown()
})

describe('tenant_local_guide_entries', () => {
  it('defaults category to other and sort_order to 0', async () => {
    const tenantId = await createTenant()
    const id = randomUUID()
    await client.query(
      `insert into tenant_local_guide_entries (id, tenant_id, name) values ($1, $2, 'Corner Shop')`,
      [id, tenantId],
    )
    const row = await client.query(`select category, sort_order from tenant_local_guide_entries where id = $1`, [id])
    expect(row.rows[0].category).toBe('other')
    expect(row.rows[0].sort_order).toBe(0)
  })

  it('accepts every documented category', async () => {
    const tenantId = await createTenant()
    for (const category of ['restaurant', 'attraction', 'transport', 'shopping', 'emergency', 'other']) {
      const id = randomUUID()
      await client.query(
        `insert into tenant_local_guide_entries (id, tenant_id, name, category) values ($1, $2, 'Place', $3)`,
        [id, tenantId, category],
      )
    }
    const rows = await client.query(`select category from tenant_local_guide_entries where tenant_id = $1`, [tenantId])
    expect(rows.rows).toHaveLength(6)
  })

  it('rejects a category outside the documented set', async () => {
    const tenantId = await createTenant()
    const id = randomUUID()
    await expect(
      client.query(
        `insert into tenant_local_guide_entries (id, tenant_id, name, category) values ($1, $2, 'Place', 'nightlife')`,
        [id, tenantId],
      ),
    ).rejects.toThrow(/check constraint/i)
  })
})
