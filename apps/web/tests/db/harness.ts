/**
 * Boots a real, throwaway Postgres cluster (via `embedded-postgres`) and
 * replays a curated subset of the actual migrations from
 * `supabase/migrations/` against it, so RLS policies can be tested against
 * the real SQL that ships to production rather than a hand-written
 * re-implementation of it.
 *
 * Supabase provides `auth.*`, `storage.*`, and a handful of roles
 * (`anon`, `authenticated`, `service_role`, `supabase_auth_admin`) that our
 * migrations assume exist. None of that ships with vanilla Postgres, so we
 * shim the minimum surface the migrations actually touch (checked via grep
 * across supabase/migrations before writing this: only `auth.uid()`,
 * `auth.role()`, `auth.users(id)`, `storage.objects`/`storage.buckets`,
 * `storage.foldername()`, and the `supabase_realtime` publication are
 * referenced — no pg_cron/pg_net/vault/pgsodium usage).
 *
 * WHY A CURATED LIST AND NOT "every file in the directory, in order":
 * Replaying the full history top-to-bottom used to fail partway through —
 * migration 20240001000014_preventive_maintenance.sql references a
 * `contractors` table that no migration created, and later migrations
 * touch `maintenance_requests` columns that didn't exist until migration
 * 105's deliberately-partial "stub" table (itself admitting the "real
 * form" was never migrated). Both were tables created by hand directly in
 * the Supabase dashboard at some point and never captured as a migration.
 * That gap is now filled by
 * 202400010000135_reconstruct_contractors_and_maintenance_requests.sql
 * (numbered to sort before 014 — see that file for the full reconstruction
 * rationale and sourcing), and verified against 014/041/057/065/105/106 in
 * a standalone replay during that work. It's included in MIGRATIONS below.
 *
 * The rest of the list is still curated rather than "every file, in
 * order": a full 116-file replay hits unrelated issues further along
 * (e.g. an `ALTER TYPE ... ADD VALUE` used in the same transaction that
 * added it, in migration 055 — likely an artifact of this harness sending
 * each file as one implicit-transaction batch rather than psql's
 * statement-by-statement execution, not a real deployment risk). Fixing
 * that is a separate task from what these tests need.
 */
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'
import type { Client } from 'pg'

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../../supabase/migrations')

/**
 * Self-contained migrations covering the tables under test in
 * tests/db/rls.test.ts and tests/db/maintenance-schema.test.ts. Verified
 * (by reading each file) to only reference tables/columns created earlier
 * in this same list, `auth.users`, or `storage.*`.
 */
const MIGRATIONS = [
  '20240001000000_platform_tables.sql', // tenants, tenant_members, enums
  '20240001000001_core_tables.sql', // room_categories, rooms, occupants, bookings, booking_payments
  '20240001000002_rls_policies.sql', // tenant_id()/tenant_role() helpers + core RLS policies
  '202400010000135_reconstruct_contractors_and_maintenance_requests.sql', // fills the gap described above
  '20240001000042_storage_buckets.sql', // tenant-logos bucket (v1 policies — later fixed)
  '20240001000046_tenant_logos_bucket.sql', // tenant-logos bucket (v2 duplicate policies — later fixed)
  '20240001000073_messaging.sql', // conversations, conversation_participants, messages(+storage bucket)
  '20240001000094_messages_realtime.sql', // replica identity + realtime publication for messages
  '20240001000113_scope_tenant_logos_storage.sql', // fix: finding #1
  '20240001000114_scope_messages_storage_upload.sql', // fix: finding #3
  '20240001000115_fix_conversation_participants_rls_recursion.sql', // fix: recursion bug found while testing #3
  '20240001000116_fix_occupants_self_select_policy.sql', // fix: finding #4
]

const SHIM_SQL = `
-- Roles the real migrations/policies reference via GRANT / "to <role>".
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon')                 then create role anon; end if;
  if not exists (select from pg_roles where rolname = 'authenticated')        then create role authenticated; end if;
  if not exists (select from pg_roles where rolname = 'service_role')         then create role service_role bypassrls; end if;
  if not exists (select from pg_roles where rolname = 'supabase_auth_admin')  then create role supabase_auth_admin; end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;
grant usage on schema auth, storage to anon, authenticated, service_role;

-- Real Supabase projects put pgcrypto/uuid-ossp/etc. in "extensions" and put
-- that schema on every role's search_path (see migrations' own
-- create extension ... schema extensions statements) so unqualified calls
-- like gen_random_bytes() resolve. Mirror that here.
alter database postgres set search_path to "$user", public, extensions;
set search_path to "$user", public, extensions;

-- Minimal auth.users — only "id" is ever referenced by our migrations.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);
grant all on auth.users to anon, authenticated, service_role;

create or replace function auth.uid() returns uuid
  language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
  $$;

create or replace function auth.role() returns text
  language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '')
  $$;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets(id),
  name       text,
  owner      uuid,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;
grant all on storage.objects, storage.buckets to anon, authenticated, service_role;

-- Real Supabase implementation splits on '/' and drops the last (filename)
-- segment. Mirrored exactly since several policies index into this array.
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$
    select case
      when array_length(string_to_array(name, '/'), 1) <= 1 then array[]::text[]
      else (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
    end
  $$;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
`.trim()

// migration 041_portal_auth.sql adds occupants.user_id (needed by 073's
// messaging RLS policies) but is excluded from MIGRATIONS above because it
// also creates a policy on "maintenance_requests" — a table hitting the
// same created-by-hand-in-the-dashboard gap described above. Apply just the
// column migration 073 depends on, once "occupants" exists (after 001).
const POST_MIGRATION_FIXUPS: Record<string, string> = {
  '20240001000001_core_tables.sql': `
    alter table occupants
      add column if not exists user_id uuid unique references auth.users(id) on delete set null;
  `,
}

export interface TestDb {
  client: Client
  /**
   * Run `fn` inside a transaction impersonating a session with these JWT
   * claims. Rolls back by default (the right choice for "this must be
   * denied" assertions, so a bug can't leave stray rows behind) — pass
   * `{ commit: true }` for "this must be allowed" assertions that need to
   * verify the row actually persisted afterward.
   */
  asUser: (
    claims: Record<string, unknown>,
    fn: (client: Client) => Promise<void>,
    opts?: { commit?: boolean },
  ) => Promise<void>
  teardown: () => Promise<void>
}

export async function startTestDb(): Promise<TestDb> {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'ghh-pgtest-'))
  const port = 55432 + Math.floor(Math.random() * 4000)

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  })

  await pg.initialise()
  await pg.start()

  const client = pg.getPgClient('postgres')
  await client.connect()

  await client.query(SHIM_SQL)

  for (const file of MIGRATIONS) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    try {
      await client.query(sql)
      if (POST_MIGRATION_FIXUPS[file]) {
        await client.query(POST_MIGRATION_FIXUPS[file])
      }
    } catch (err) {
      throw new Error(`Migration ${file} failed to replay against the test DB: ${(err as Error).message}`)
    }
  }

  return {
    client,
    async asUser(claims, fn, opts) {
      await client.query('begin')
      try {
        await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)])
        await client.query('set local role authenticated')
        await fn(client)
        await client.query(opts?.commit ? 'commit' : 'rollback')
      } catch (err) {
        await client.query('rollback')
        throw err
      }
    },
    async teardown() {
      await client.end()
      await pg.stop()
      rmSync(dataDir, { recursive: true, force: true })
    },
  }
}
