/**
 * Integration tests for migration 123 (platform_plans table): durable
 * storage for Paystack plan codes, replacing the previous env-var-only
 * approach. This table has no FK dependencies beyond what the base harness
 * already provides (set_updated_at() is defined in migration 000).
 *
 * Scope note: this only tests the table's own constraints (uniqueness,
 * check constraints, RLS lockdown). Nothing in the app reads from this
 * table yet — the bootstrap-plans endpoint writes to it, but
 * lib/platform-plans.ts's read path (env-var resolution) is unchanged.
 * See the migration file's own header comment.
 */
import { randomUUID } from 'node:crypto'

import type { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { startTestDb, type TestDb } from './harness'

let db: TestDb
let client: Client

beforeAll(async () => {
  db = await startTestDb({
    extraMigrationFiles: ['20240001000123_platform_plans_table.sql'],
  })
  client = db.client
}, 60_000)

afterAll(async () => {
  await db.teardown()
})

describe('platform_plans', () => {
  it('inserts a plan row with the expected defaults', async () => {
    const id = randomUUID()
    await client.query(
      `insert into platform_plans (id, tier, billing_interval, plan_code, amount_pesewas, paystack_interval)
       values ($1, 'starter', 'monthly', 'PLN_test_starter_monthly', 80000, 'monthly')`,
      [id],
    )
    const row = await client.query(`select business_type, tier, billing_interval, plan_code from platform_plans where id = $1`, [id])
    expect(row.rows[0]).toMatchObject({
      business_type: 'hostel',
      tier: 'starter',
      billing_interval: 'monthly',
      plan_code: 'PLN_test_starter_monthly',
    })
  })

  it('accepts an explicit hotel business_type', async () => {
    const id = randomUUID()
    await client.query(
      `insert into platform_plans (id, business_type, tier, billing_interval, plan_code, amount_pesewas, paystack_interval)
       values ($1, 'hotel', 'starter', 'monthly', 'PLN_test_hotel_starter', 90000, 'monthly')`,
      [id],
    )
    const row = await client.query(`select business_type from platform_plans where id = $1`, [id])
    expect(row.rows[0].business_type).toBe('hotel')
  })

  it('rejects a business_type outside the known verticals', async () => {
    const id = randomUUID()
    await expect(
      client.query(
        `insert into platform_plans (id, business_type, tier, billing_interval, plan_code, amount_pesewas, paystack_interval)
         values ($1, 'apartment', 'starter', 'monthly', 'PLN_x', 1000, 'monthly')`,
        [id],
      ),
    ).rejects.toThrow(/check constraint/i)
  })

  it('rejects a billing_interval outside the known set', async () => {
    const id = randomUUID()
    await expect(
      client.query(
        `insert into platform_plans (id, tier, billing_interval, plan_code, amount_pesewas, paystack_interval)
         values ($1, 'starter', 'daily', 'PLN_x', 1000, 'monthly')`,
        [id],
      ),
    ).rejects.toThrow(/check constraint/i)
  })

  it('enforces uniqueness on (business_type, tier, billing_interval)', async () => {
    const id1 = randomUUID()
    const id2 = randomUUID()
    await client.query(
      `insert into platform_plans (id, tier, billing_interval, plan_code, amount_pesewas, paystack_interval)
       values ($1, 'growth', 'annual', 'PLN_growth_annual', 1000000, 'annually')`,
      [id1],
    )
    await expect(
      client.query(
        `insert into platform_plans (id, tier, billing_interval, plan_code, amount_pesewas, paystack_interval)
         values ($1, 'growth', 'annual', 'PLN_growth_annual_dup', 1000000, 'annually')`,
        [id2],
      ),
    ).rejects.toThrow(/duplicate key value violates unique constraint/i)
  })

  it('bumps updated_at on update via the set_updated_at trigger', async () => {
    const id = randomUUID()
    await client.query(
      `insert into platform_plans (id, tier, billing_interval, plan_code, amount_pesewas, paystack_interval)
       values ($1, 'starter', 'quarterly', 'PLN_q', 76000, 'quarterly')`,
      [id],
    )
    const before = await client.query(`select updated_at from platform_plans where id = $1`, [id])
    await new Promise((r) => setTimeout(r, 10))
    await client.query(`update platform_plans set plan_code = 'PLN_q_v2' where id = $1`, [id])
    const after = await client.query(`select updated_at from platform_plans where id = $1`, [id])
    expect(new Date(after.rows[0].updated_at).getTime()).toBeGreaterThan(new Date(before.rows[0].updated_at).getTime())
  })
})
