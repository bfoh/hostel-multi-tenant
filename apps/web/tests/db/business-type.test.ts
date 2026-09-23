/**
 * Integration tests for migration 122 (tenants.business_type): the first
 * schema step of the hotel vertical. Verifies the additive-column contract
 * every prior tenants column of this shape follows (listed_publicly,
 * booking_payment_mode in migration 119) — a constant default that requires
 * no backfill, and a check constraint that rejects anything outside the
 * known verticals.
 *
 * Applies migrations 4/118/119/122 on top of the base harness list (see
 * tests/db/harness.ts for why the base list stops at 116/117): 004 adds
 * address_city (indexed by 119 and, now, by 122's widened index), 118/119
 * are prerequisites of 122's own index (which references listed_publicly
 * and status, both introduced there).
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
    ],
  })
  client = db.client
}, 60_000)

afterAll(async () => {
  await db.teardown()
})

describe('tenants.business_type', () => {
  it('defaults existing-shaped inserts to hostel with zero backfill required', async () => {
    const id = randomUUID()
    await client.query(`insert into tenants (id, name, slug) values ($1, 'Test Hostel', $2)`, [
      id,
      `test-hostel-${id.slice(0, 8)}`,
    ])
    const row = await client.query(`select business_type from tenants where id = $1`, [id])
    expect(row.rows[0].business_type).toBe('hostel')
  })

  it('accepts an explicit hotel value', async () => {
    const id = randomUUID()
    await client.query(
      `insert into tenants (id, name, slug, business_type) values ($1, 'Test Hotel', $2, 'hotel')`,
      [id, `test-hotel-${id.slice(0, 8)}`],
    )
    const row = await client.query(`select business_type from tenants where id = $1`, [id])
    expect(row.rows[0].business_type).toBe('hotel')
  })

  it('rejects a value outside the known verticals', async () => {
    const id = randomUUID()
    await expect(
      client.query(`insert into tenants (id, name, slug, business_type) values ($1, 'Test Apt', $2, 'apartment')`, [
        id,
        `test-apt-${id.slice(0, 8)}`,
      ]),
    ).rejects.toThrow(/check constraint/i)
  })

  it('is not nullable', async () => {
    const id = randomUUID()
    await expect(
      client.query(`insert into tenants (id, name, slug, business_type) values ($1, 'Test Null', $2, null)`, [
        id,
        `test-null-${id.slice(0, 8)}`,
      ]),
    ).rejects.toThrow(/null value in column "business_type"/i)
  })
})
