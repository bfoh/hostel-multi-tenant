/**
 * Regression tests for migration 149: residents' sessions carry the
 * tenant_id claim, and migration 005's HR read policies checked nothing
 * else, so a resident could read every staff member's salary, ID numbers and
 * bank details over the REST API. Runs the real migrations on a throwaway
 * Postgres.
 */
import { randomUUID } from 'node:crypto'

import type { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { startTestDb, type TestDb } from './harness'

let db: TestDb
let client: Client

const tenantA = randomUUID()
const tenantB = randomUUID()
const owner = randomUUID()
const housekeeper = randomUUID()
const resident = randomUUID()

beforeAll(async () => {
  db = await startTestDb({
    extraMigrationFiles: ['20240001000005_hr_tables.sql', '20240001000149_hr_tables_staff_only_read.sql'],
  })
  client = db.client
  await client.query(`insert into auth.users (id) values ($1), ($2), ($3)`, [owner, housekeeper, resident])
  for (const [id, slug] of [[tenantA, 'hr-a'], [tenantB, 'hr-b']]) {
    await client.query(`insert into tenants (id, name, slug, status) values ($1, $2, $2, 'active')`, [id, slug])
  }
  const members = await client.query(
    `insert into tenant_members (tenant_id, user_id, role, is_active)
     values ($1, $2, 'owner', true), ($1, $3, 'housekeeper', true) returning id`,
    [tenantA, owner, housekeeper],
  )
  const profiles = await client.query(
    `insert into staff_profiles (tenant_id, member_id, user_id, first_name, last_name, basic_salary, ghana_card_number, bank_account_number)
     values ($1, $2, $3, 'Owner', 'A', 900000, 'GHA-1', '111'), ($1, $4, $5, 'House', 'B', 150000, 'GHA-2', '222')
     returning id`,
    [tenantA, members.rows[0].id, owner, members.rows[1].id, housekeeper],
  )
  await client.query(
    `insert into attendance_records (tenant_id, staff_id, date, clock_in) values ($1, $2, current_date, now())`,
    [tenantA, profiles.rows[1].id],
  )
  await client.query(
    `insert into leave_requests (tenant_id, staff_id, leave_type, start_date, end_date, reason)
     values ($1, $2, 'sick', current_date, current_date, 'private')`,
    [tenantA, profiles.rows[1].id],
  )
}, 60_000)

afterAll(async () => {
  await db.teardown()
})

const READS = {
  staff_profiles: 'select basic_salary, ghana_card_number, bank_account_number from staff_profiles',
  attendance_records: 'select id from attendance_records',
  leave_requests: 'select reason from leave_requests',
}

describe.each(Object.entries(READS))('%s', (_table, sql) => {
  it('is hidden from a resident of the property', async () => {
    await db.asUser({ sub: resident, role: 'authenticated', tenant_id: tenantA, portal_role: 'occupant' }, async (c) => {
      expect((await c.query(sql)).rowCount).toBe(0)
    })
  })

  it('is still readable by the property\'s staff', async () => {
    for (const [sub, tenant_role] of [[owner, 'owner'], [housekeeper, 'housekeeper']]) {
      await db.asUser({ sub, role: 'authenticated', tenant_id: tenantA, tenant_role, portal_role: 'staff' }, async (c) => {
        expect((await c.query(sql)).rowCount).toBeGreaterThan(0)
      })
    }
  })

  it('is hidden from another property\'s owner', async () => {
    await db.asUser({ sub: randomUUID(), role: 'authenticated', tenant_id: tenantB, tenant_role: 'owner' }, async (c) => {
      expect((await c.query(sql)).rowCount).toBe(0)
    })
  })
})
