/**
 * Regression tests for migration 117 (finding #5 follow-up): five
 * SECURITY DEFINER functions took a caller-supplied tenant_id/room_id and
 * used it to scope an internal read/write, but were also directly
 * callable via PostgREST's /rest/v1/rpc/<name> by `authenticated` (or, for
 * compute_daily_report, by literally anyone — Postgres grants EXECUTE to
 * PUBLIC by default and no migration ever revoked it).
 *
 * These tests don't invoke the functions' logic — they check the actual
 * grant state directly with has_function_privilege(), which is what
 * PostgREST itself consults to decide whether to allow the RPC call at
 * all. That's the real boundary that was broken.
 */
import type { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { RPC_GRANTS_FIX_MIGRATION, startTestDb, type TestDb } from './harness'

let db: TestDb
let client: Client

async function canExecute(role: string, signature: string): Promise<boolean> {
  const { rows } = await client.query(`select has_function_privilege($1, $2, 'EXECUTE') as ok`, [role, signature])
  return rows[0].ok
}

// Minimal stand-ins for the five real functions migration 117 locks down —
// same names/argument types/original grants (verified against migrations
// 069/070/072/077), trivial bodies since only the grant boundary is under
// test here, not the business logic. See harness.ts's comment on
// RPC_GRANTS_FIX_MIGRATION for why these aren't the real migration files.
const STUB_FUNCTIONS_WITH_ORIGINAL_GRANTS = `
create or replace function release_stale_pending_payment_bookings(p_tenant_id uuid, p_max_age_minutes int default 30)
returns int language sql as $$ select 0 $$;
grant execute on function release_stale_pending_payment_bookings(uuid, int) to service_role, authenticated;

create or replace function release_stale_self_checkin_reservations(p_tenant_id uuid, p_max_age_minutes int default 30)
returns int language sql as $$ select 0 $$;
grant execute on function release_stale_self_checkin_reservations(uuid, int) to service_role, authenticated;

-- No explicit grant here, matching production: this relies entirely on
-- Postgres's default "EXECUTE granted to PUBLIC on every new function".
create or replace function compute_daily_report(p_tenant_id uuid, p_date date default current_date)
returns int language sql as $$ select 0 $$;

create or replace function room_active_bed_count(p_room_id uuid, p_as_of date default current_date)
returns int language sql as $$ select 0 $$;
grant execute on function room_active_bed_count(uuid, date) to service_role, authenticated;

create or replace function room_free_bed_count(p_room_id uuid)
returns int language sql as $$ select 0 $$;
grant execute on function room_free_bed_count(uuid) to service_role, authenticated;
`

beforeAll(async () => {
  db = await startTestDb({
    beforeExtraMigrations: STUB_FUNCTIONS_WITH_ORIGINAL_GRANTS,
    extraMigrationFiles: [RPC_GRANTS_FIX_MIGRATION],
  })
  client = db.client
}, 60_000)

afterAll(async () => {
  await db.teardown()
})

describe('tenant-scoped RPC grants (migration 117)', () => {
  const FUNCTIONS = [
    'release_stale_pending_payment_bookings(uuid, int)',
    'release_stale_self_checkin_reservations(uuid, int)',
    'compute_daily_report(uuid, date)',
    'room_active_bed_count(uuid, date)',
    'room_free_bed_count(uuid)',
  ]

  it.each(FUNCTIONS)('authenticated cannot execute %s', async (sig) => {
    expect(await canExecute('authenticated', sig)).toBe(false)
  })

  it.each(FUNCTIONS)('anon cannot execute %s', async (sig) => {
    expect(await canExecute('anon', sig)).toBe(false)
  })

  it.each(FUNCTIONS)('service_role can still execute %s (the app only ever calls these via the admin client)', async (sig) => {
    expect(await canExecute('service_role', sig)).toBe(true)
  })
})
