-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 036 — Occupant Blacklist
-- ═══════════════════════════════════════════════════════════════════════════

create table occupant_blacklist (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  occupant_id  uuid references occupants(id) on delete cascade,
  -- Also support blacklisting by phone (for people not yet in system)
  phone        text,
  reason       text not null,
  severity     text not null default 'warning'
               check (severity in ('warning','banned')),
  is_active    boolean not null default true,
  expires_at   timestamptz,           -- null = permanent
  added_by     uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  check (occupant_id is not null or phone is not null)
);

create trigger occupant_blacklist_updated_at
  before update on occupant_blacklist
  for each row execute function set_updated_at();

create index on occupant_blacklist (tenant_id, is_active);
create index on occupant_blacklist (occupant_id) where occupant_id is not null;
create index on occupant_blacklist (tenant_id, phone) where phone is not null;

alter table occupant_blacklist enable row level security;

create policy "tenant members can manage blacklist"
  on occupant_blacklist for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );
