/**
 * Integration test for migration 136 (marketing_campaigns) — check
 * constraints on channel/audience/status and the draft-default contract
 * a newly created campaign relies on.
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
    extraMigrationFiles: ['20240001000136_marketing_campaigns.sql'],
  })
  client = db.client
}, 60_000)

afterAll(async () => {
  await db.teardown()
})

describe('marketing_campaigns', () => {
  it('defaults to a draft with all_occupants audience and zero recipients', async () => {
    const tenantId = await createTenant()
    const id = randomUUID()
    await client.query(
      `insert into marketing_campaigns (id, tenant_id, name, channel, body) values ($1, $2, 'Test', 'sms', 'Hello!')`,
      [id, tenantId],
    )
    const row = await client.query(`select status, audience, recipient_count from marketing_campaigns where id = $1`, [id])
    expect(row.rows[0].status).toBe('draft')
    expect(row.rows[0].audience).toBe('all_occupants')
    expect(row.rows[0].recipient_count).toBe(0)
  })

  it('rejects a channel outside sms/email', async () => {
    const tenantId = await createTenant()
    const id = randomUUID()
    await expect(
      client.query(
        `insert into marketing_campaigns (id, tenant_id, name, channel, body) values ($1, $2, 'Test', 'whatsapp', 'Hi')`,
        [id, tenantId],
      ),
    ).rejects.toThrow(/check constraint/i)
  })

  it('rejects an audience outside the documented set', async () => {
    const tenantId = await createTenant()
    const id = randomUUID()
    await expect(
      client.query(
        `insert into marketing_campaigns (id, tenant_id, name, channel, body, audience) values ($1, $2, 'Test', 'sms', 'Hi', 'vip_only')`,
        [id, tenantId],
      ),
    ).rejects.toThrow(/check constraint/i)
  })
})
