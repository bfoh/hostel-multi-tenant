/**
 * Regression test for migration 150: room_occupancy_v bypasses RLS (it runs
 * with its owner's rights) and Supabase's default grants exposed it to the
 * anon key, so anyone could read every property's rooms and occupancy.
 *
 * The real view (migrations 070/077) pulls in a long unrelated dependency
 * chain, so this builds a stand-in with the same name, owner-rights
 * behaviour and original grants, then applies the real migration 150.
 */
import type { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { startTestDb, type TestDb } from './harness'

let db: TestDb
let client: Client

const STAND_IN_VIEW_WITH_ORIGINAL_GRANTS = `
create or replace view room_occupancy_v as
  select r.id as room_id, r.tenant_id, r.room_number from rooms r;
grant select on room_occupancy_v to service_role, authenticated;
`

beforeAll(async () => {
  db = await startTestDb({
    beforeExtraMigrations: STAND_IN_VIEW_WITH_ORIGINAL_GRANTS,
    extraMigrationFiles: ['20240001000150_room_occupancy_view_service_only.sql'],
  })
  client = db.client
}, 60_000)

afterAll(async () => {
  await db.teardown()
})

const canSelect = async (role: string) =>
  (await client.query(`select has_table_privilege($1, 'room_occupancy_v', 'select') as ok`, [role])).rows[0].ok

describe('room_occupancy_v grants (migration 150)', () => {
  it.each(['anon', 'authenticated'])('%s cannot read the view', async (role) => {
    expect(await canSelect(role)).toBe(false)
  })

  it('the service role (every app reader) still can', async () => {
    expect(await canSelect('service_role')).toBe(true)
  })
})
