-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 000013.5 — Reconstruct contractors + maintenance_requests
--
-- WHY THIS FILE EXISTS AND WHY IT'S NUMBERED HERE (between 013 and 014):
--
-- Migration 20240001000014_preventive_maintenance.sql references
-- "contractors(id)" via a foreign key and ALTERs "maintenance_requests",
-- but no migration anywhere in this repo ever creates either table. Both
-- were created by hand, directly against the production database (almost
-- certainly via the Supabase Studio table editor), before this migration
-- history was fully disciplined about capturing schema changes. Migration
-- 20240001000106_align_digest_stub_columns.sql even documents hitting this:
-- its own comment says a "stub" create-table for maintenance_requests "was
-- therefore a no-op" because the real table already existed with a
-- different, undocumented shape.
--
-- Effect on PRODUCTION: none. Both tables already exist there, so every
-- statement below is written to be a safe no-op against that database:
-- `create table if not exists`, `add column if not exists`,
-- `create index if not exists`, and RLS policies given names that don't
-- collide with any policy created by a later migration in this repo. The
-- one exception is `enable row level security`, which is idempotent by
-- itself but is worth calling out explicitly — see the RLS section below
-- for what that means if production's real policies differ from these.
--
-- Effect on a FRESH environment (new dev machine, CI, disaster recovery):
-- everything. Without this file, `supabase db reset` fails part-way
-- through migration 014 today. This file is deliberately numbered to sort
-- before 014 (013 < 0000135 < 014 as strings — see the migration list this
-- was verified against) so a from-scratch replay actually completes.
--
-- SOURCES FOR THE COLUMN LIST (in order of confidence):
--   1. packages/types/src/database.ts — hand-maintained, NOT regenerated
--      from a live `supabase gen types typescript` on every schema change,
--      but its contractors/maintenance_requests blocks were cross-checked
--      against every .from('contractors'|'maintenance_requests') call,
--      Zod schema, and TypeScript interface in apps/web (see below) and
--      matched everywhere they overlapped.
--   2. Every migration that ALTERs maintenance_requests after the fact
--      (014 pm_schedule_id, 057 occupant_id/last_message_at/message_count/
--      closed_by_kind, 065 source, 106 confirms tenant_id/status/
--      completed_at/created_at already existed) — these columns are
--      included directly below so those later ALTERs become no-ops.
--   3. apps/web/app/api/maintenance/route.ts and
--      apps/web/app/api/occupant/maintenance/route.ts (Zod validation
--      schemas — confirms category/priority enum value sets exactly).
--   4. apps/web/lib/data/maintenance.ts, lib/maintenance/messages.ts, and
--      every apps/web/app/api/maintenance/**/*.ts route (confirms which
--      columns are actually read/written and their nullability in
--      practice).
--
-- RECONSTRUCTED, NOT RECOVERED (called out inline below too):
--   - ref_number's generation. Insert type omits it (optional), so
--     production has *some* default/trigger producing it — apps/web never
--     sets it except one call site (api/pm-schedules/[id]/run/route.ts,
--     which uses its own literal "MR-PM-<ts>" format, implying the DB
--     default uses a different prefix for the normal path). What's below
--     mirrors this repo's own generate_invoice_number() pattern
--     (migration 008) as a reasonable, consistent choice — it is very
--     unlikely to be byte-identical to whatever's actually live.
--   - RLS policies on both tables. No migration ever added any to
--     "contractors"; only a SELECT policy (migration 105) and an INSERT
--     policy (migration 041) exist anywhere for "maintenance_requests".
--     What's below fills the gaps using this schema's own established
--     convention (pm_schedules' "tenant members can manage" pattern —
--     DB-layer check is "any active tenant_member of this tenant", with
--     specific-role gating left to the app layer via requireTenantRole(),
--     exactly like every other module in this codebase). If production's
--     contractors table currently has NO RLS at all, this migration
--     newly protects it — a real improvement. If production already has
--     different policies, `enable row level security` is a no-op and the
--     uniquely-named policies below simply add to (never replace) whatever
--     is already there.
--   - The rating column's numeric type/bounds (guessed as unconstrained
--     numeric — not enforced in production per this reconstruction, since
--     there's no way to confirm precision/scale without live DB access).
--
-- If you have access to the live Supabase project, the trustworthy way to
-- confirm or correct anything in this file is:
--   supabase db diff --linked --schema public -f verify_013_5_reconstruction
-- which will show whether this migration's shape actually matches
-- production once applied to a shadow database, or
--   supabase db dump --linked --schema public -x contractors -x maintenance_requests
-- to pull the real DDL directly.
-- ═══════════════════════════════════════════════════════════════════════════

-- Confirmed as real native Postgres enums, not text+check: supabase gen
-- types emits a distinct named union type only for an actual enum column.
do $$ begin
  create type maintenance_category as enum (
    'plumbing', 'electrical', 'hvac', 'structural', 'cleaning',
    'furniture', 'appliance', 'pest_control', 'security', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type maintenance_priority as enum ('low', 'medium', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type maintenance_status as enum ('open', 'in_progress', 'on_hold', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

-- ── contractors ──────────────────────────────────────────────────────────────

create table if not exists contractors (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  company     text,
  phone       text not null,
  email       text,
  specialty   maintenance_category not null default 'other',
  rating      numeric,                       -- reconstructed: bounds unconfirmed
  notes       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists idx_contractors_tenant on contractors (tenant_id);
create index if not exists idx_contractors_tenant_active on contractors (tenant_id, is_active);

alter table contractors enable row level security;

create policy "contractors_tenant_members_manage"
  on contractors
  using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = contractors.tenant_id
        and tm.user_id   = auth.uid()
        and tm.is_active = true
    )
  )
  with check (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = contractors.tenant_id
        and tm.user_id   = auth.uid()
        and tm.is_active = true
    )
  );

-- ── maintenance_requests ─────────────────────────────────────────────────────
-- pm_schedule_id is intentionally NOT created here — migration 014 creates
-- pm_schedules and then runs
-- `alter table maintenance_requests add column if not exists pm_schedule_id
-- uuid references pm_schedules(id) on delete set null;` immediately after,
-- which would forward-reference a table that doesn't exist yet if that
-- column were added this early. Let 014 add it in its original place.

create table if not exists maintenance_requests (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  ref_number      text not null,
  title           text not null,
  description     text,
  category        maintenance_category not null,
  priority        maintenance_priority not null default 'medium',
  status          maintenance_status not null default 'open',
  room_id         uuid references rooms(id) on delete set null,
  contractor_id   uuid references contractors(id) on delete set null,
  source          text,                      -- migration 065 origin; included here directly
  scheduled_date  date,
  assigned_at     timestamptz,
  resolved_at     timestamptz,
  actual_cost     integer,
  estimated_cost  integer,
  notes           text,
  reported_by     uuid references auth.users(id) on delete set null,
  occupant_id     uuid references occupants(id) on delete set null,      -- migration 057 origin
  last_message_at timestamptz,                                          -- migration 057 origin
  message_count   integer not null default 0,                           -- migration 057 origin
  closed_by_kind  text check (closed_by_kind in ('occupant', 'staff')),  -- migration 057 origin
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (tenant_id, ref_number)  -- reconstructed: not confirmed in production
);

create index if not exists idx_maintenance_requests_tenant on maintenance_requests (tenant_id);
create index if not exists idx_maintenance_requests_tenant_status on maintenance_requests (tenant_id, status);

create trigger maintenance_requests_updated_at
  before update on maintenance_requests
  for each row execute function set_updated_at();

-- RECONSTRUCTED ref_number generation (see header). Mirrors
-- generate_invoice_number() from migration 008 for consistency with this
-- codebase's own convention. Only fires when the caller hasn't already
-- supplied one (api/pm-schedules/[id]/run/route.ts sets its own
-- "MR-PM-<ts>" value and must be left alone).
create or replace function generate_maintenance_ref_number(p_tenant_id uuid)
returns text language plpgsql as $$
declare
  v_year text := to_char(now(), 'YYYY');
  v_seq  integer;
begin
  select coalesce(max(
    case
      when ref_number ~ ('^MR-' || v_year || '-\d+$')
      then (regexp_match(ref_number, '\d+$'))[1]::integer
      else 0
    end
  ), 0) + 1
  into v_seq
  from maintenance_requests
  where tenant_id = p_tenant_id;

  return 'MR-' || v_year || '-' || lpad(v_seq::text, 5, '0');
end;
$$;

create or replace function maintenance_requests_set_ref_number()
returns trigger language plpgsql as $$
begin
  if new.ref_number is null or new.ref_number = '' then
    new.ref_number := generate_maintenance_ref_number(new.tenant_id);
  end if;
  return new;
end;
$$;

create trigger maintenance_requests_ref_number
  before insert on maintenance_requests
  for each row execute function maintenance_requests_set_ref_number();

alter table maintenance_requests enable row level security;

-- A SELECT policy is required here, not just left for migration 105 to add
-- later: UPDATE/DELETE row-matching itself needs RLS-visible rows to find
-- what the WHERE clause targets, independent of whatever an UPDATE/DELETE
-- policy's own USING clause allows. Without this, staff could not update
-- or delete their own tenant's requests until migration 105 ran — a gap
-- this reconstruction would otherwise be reintroducing on its own.
-- Distinct name from migration 105's "tenant members read maintenance"
-- (which still applies on top of this, redundantly but harmlessly, once
-- it runs) and migration 041's "occupant can create maintenance request".
create policy "maintenance_requests_tenant_members_select"
  on maintenance_requests
  for select
  using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = maintenance_requests.tenant_id
        and tm.user_id   = auth.uid()
        and tm.is_active = true
    )
  );

-- Fine-grained role gating (e.g. requireTenantRole(['owner', 'manager'])
-- for priority/reopen) happens at the app layer, same as everywhere else
-- in this codebase — this UPDATE policy uses the same "any active
-- tenant_member" convention as pm_schedules and contractors above.
create policy "maintenance_requests_tenant_members_manage"
  on maintenance_requests
  for update
  using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = maintenance_requests.tenant_id
        and tm.user_id   = auth.uid()
        and tm.is_active = true
    )
  )
  with check (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = maintenance_requests.tenant_id
        and tm.user_id   = auth.uid()
        and tm.is_active = true
    )
  );

create policy "maintenance_requests_tenant_members_delete"
  on maintenance_requests
  for delete
  using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = maintenance_requests.tenant_id
        and tm.user_id   = auth.uid()
        and tm.is_active = true
        and tm.role in ('owner', 'manager')
    )
  );
