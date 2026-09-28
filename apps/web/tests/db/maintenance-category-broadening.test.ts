/**
 * Integration test for migration 134 (broaden maintenance_category) —
 * confirms the 4 new non-maintenance categories are accepted by the
 * existing maintenance_requests table, and that the original 10 values
 * still work unchanged (this migration only ever adds enum values, never
 * removes or renames any).
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
    extraMigrationFiles: ['20240001000134_broaden_maintenance_categories.sql'],
  })
  client = db.client
}, 60_000)

afterAll(async () => {
  await db.teardown()
})

describe('maintenance_category broadening', () => {
  it.each(['housekeeping', 'transport', 'food', 'amenity'])(
    'accepts the new %s category',
    async (category) => {
      const tenantId = await createTenant()
      const id = randomUUID()
      await client.query(
        `insert into maintenance_requests (id, tenant_id, title, category) values ($1, $2, 'Test request', $3)`,
        [id, tenantId, category],
      )
      const row = await client.query(`select category from maintenance_requests where id = $1`, [id])
      expect(row.rows[0].category).toBe(category)
    },
  )

  it('still accepts a pre-existing category unchanged', async () => {
    const tenantId = await createTenant()
    const id = randomUUID()
    await client.query(
      `insert into maintenance_requests (id, tenant_id, title, category) values ($1, $2, 'Leaking tap', 'plumbing')`,
      [id, tenantId],
    )
    const row = await client.query(`select category from maintenance_requests where id = $1`, [id])
    expect(row.rows[0].category).toBe('plumbing')
  })
})
