/**
 * Integration tests for migration 131 (tenants.accommodation_type) — the
 * marketplace-only sub-category that splits Hotels from Apartments within
 * the shared business_type='hotel' pool, without touching business_type
 * itself (which also drives subdomain routing — see
 * lib/tenant/host-classification.ts).
 */
import { randomUUID } from 'node:crypto'

import type { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { startTestDb, type TestDb } from './harness'

let db: TestDb
let client: Client

beforeAll(async () => {
  db = await startTestDb({
    extraMigrationFiles: [
      '20240001000004_tenant_contact_fields.sql',
      '20240001000118_tenant_status_trial_expired.sql',
      '20240001000119_public_marketplace_columns.sql',
      '20240001000122_tenants_business_type.sql',
      '20240001000131_hotel_accommodation_type.sql',
    ],
  })
  client = db.client
}, 60_000)

afterAll(async () => {
  await db.teardown()
})

describe('tenants.accommodation_type', () => {
  it('defaults existing-shaped inserts to hotel with zero backfill required', async () => {
    const id = randomUUID()
    await client.query(
      `insert into tenants (id, name, slug, business_type) values ($1, 'Test Hotel', $2, 'hotel')`,
      [id, `test-hotel-${id.slice(0, 8)}`],
    )
    const row = await client.query(`select accommodation_type from tenants where id = $1`, [id])
    expect(row.rows[0].accommodation_type).toBe('hotel')
  })

  it('accepts an explicit apartment value', async () => {
    const id = randomUUID()
    await client.query(
      `insert into tenants (id, name, slug, business_type, accommodation_type) values ($1, 'Test Apt', $2, 'hotel', 'apartment')`,
      [id, `test-apt-${id.slice(0, 8)}`],
    )
    const row = await client.query(`select accommodation_type from tenants where id = $1`, [id])
    expect(row.rows[0].accommodation_type).toBe('apartment')
  })

  it('rejects a value outside hotel/apartment', async () => {
    const id = randomUUID()
    await expect(
      client.query(
        `insert into tenants (id, name, slug, business_type, accommodation_type) values ($1, 'Test Bad', $2, 'hotel', 'guesthouse')`,
        [id, `test-bad-${id.slice(0, 8)}`],
      ),
    ).rejects.toThrow(/check constraint/i)
  })

  it('is not nullable', async () => {
    const id = randomUUID()
    await expect(
      client.query(
        `insert into tenants (id, name, slug, business_type, accommodation_type) values ($1, 'Test Null', $2, 'hotel', null)`,
        [id, `test-null-${id.slice(0, 8)}`],
      ),
    ).rejects.toThrow(/null value in column "accommodation_type"/i)
  })
})
