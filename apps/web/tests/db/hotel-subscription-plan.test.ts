/**
 * Integration tests for migrations 124/125 (subscription_plan gains
 * 'hotel_starter'/'hotel_growth'). Verifies tenants.plan — the column the
 * activate_tenant_on_subscription trigger (migration 049) writes to on every
 * successful Paystack subscription — accepts the new hotel tier values,
 * since a failed cast there would silently break subscription activation
 * for hotel tenants.
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
      '20240001000124_subscription_plan_hotel_starter.sql',
      '20240001000125_subscription_plan_hotel_growth.sql',
    ],
  })
  client = db.client
}, 60_000)

afterAll(async () => {
  await db.teardown()
})

describe('subscription_plan hotel tiers', () => {
  it('accepts hotel_starter on tenants.plan', async () => {
    const id = randomUUID()
    await client.query(
      `insert into tenants (id, name, slug, plan) values ($1, 'Test Hotel', $2, 'hotel_starter')`,
      [id, `test-hotel-starter-${id.slice(0, 8)}`],
    )
    const row = await client.query(`select plan from tenants where id = $1`, [id])
    expect(row.rows[0].plan).toBe('hotel_starter')
  })

  it('accepts hotel_growth on tenants.plan', async () => {
    const id = randomUUID()
    await client.query(
      `insert into tenants (id, name, slug, plan) values ($1, 'Test Hotel', $2, 'hotel_growth')`,
      [id, `test-hotel-growth-${id.slice(0, 8)}`],
    )
    const row = await client.query(`select plan from tenants where id = $1`, [id])
    expect(row.rows[0].plan).toBe('hotel_growth')
  })

  it('still defaults to starter for existing-shaped inserts', async () => {
    const id = randomUUID()
    await client.query(`insert into tenants (id, name, slug) values ($1, 'Test Hostel', $2)`, [
      id,
      `test-hostel-${id.slice(0, 8)}`,
    ])
    const row = await client.query(`select plan from tenants where id = $1`, [id])
    expect(row.rows[0].plan).toBe('starter')
  })

  it('rejects a value outside the known plans', async () => {
    const id = randomUUID()
    await expect(
      client.query(`insert into tenants (id, name, slug, plan) values ($1, 'Test', $2, 'bogus_plan')`, [
        id,
        `test-bogus-${id.slice(0, 8)}`,
      ]),
    ).rejects.toThrow(/invalid input value for enum subscription_plan/i)
  })
})
