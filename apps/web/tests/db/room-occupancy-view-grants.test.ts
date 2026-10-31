/**
 * Regression tests for migrations 150 and 151. Migration 150: room_occupancy_v bypasses RLS (it runs
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
grant select on room_occupancy_v to public;
create table booking_otps (booking_id uuid primary key, tenant_id uuid, phone text, otp_code text, expires_at timestamptz, used_at timestamptz);
`

beforeAll(async () => {
  db = await startTestDb({
    beforeExtraMigrations: STAND_IN_VIEW_WITH_ORIGINAL_GRANTS,
    extraMigrationFiles: ['20240001000150_room_occupancy_view_service_only.sql', '20240001000151_booking_otps_service_only.sql'],
  })
  client = db.client
}, 60_000)

afterAll(async () => {
  await db.teardown()
})

const canSelect = async (role: string) =>
  (await client.query(`select has_table_privilege($1, 'room_occupancy_v', 'select') as ok`, [role])).rows[0].ok
const otpPrivileges = async (role: string) =>
  (await client.query(
    `select array_remove(array[
       case when has_table_privilege($1, 'booking_otps', 'select') then 'select' end,
       case when has_table_privilege($1, 'booking_otps', 'insert') then 'insert' end,
       case when has_table_privilege($1, 'booking_otps', 'update') then 'update' end,
       case when has_table_privilege($1, 'booking_otps', 'delete') then 'delete' end], null) as p`, [role])).rows[0].p

describe('room_occupancy_v grants (migration 150)', () => {
  it.each(['anon', 'authenticated'])('%s cannot read the view', async (role) => {
    expect(await canSelect(role)).toBe(false)
  })

  it('the service role (every app reader) still can', async () => {
    expect(await canSelect('service_role')).toBe(true)
  })
})

// Migration 151: booking_otps was created by hand with no RLS, readable and
// writable with the anon key. Only app/api/ai/chat uses it, via the service role.
describe('booking_otps (migration 151)', () => {
  it('has RLS on', async () => {
    const r = await client.query(`select relrowsecurity from pg_class where relname = 'booking_otps'`)
    expect(r.rows[0].relrowsecurity).toBe(true)
  })

  it.each(['anon', 'authenticated'])('%s has no privileges on it', async (role) => {
    expect(await otpPrivileges(role)).toEqual([])
  })

  it('the service role keeps full access', async () => {
    expect(await otpPrivileges('service_role')).toEqual(['select', 'insert', 'update', 'delete'])
  })
})
