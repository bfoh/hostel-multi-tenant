-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 023 — Rate management & seasonal pricing
-- ═══════════════════════════════════════════════════════════════════════════

-- Base rate overrides per room category for a date window
create table rate_overrides (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  category_id  uuid references room_categories(id) on delete cascade,
  -- NULL category_id = applies to ALL categories (property-wide rate)
  name         text not null,           -- e.g. "Christmas Holiday 2025"
  rate_type    text not null default 'fixed'  -- 'fixed' | 'percent_add' | 'percent_off'
               check (rate_type in ('fixed', 'percent_add', 'percent_off')),
  value        numeric(12,2) not null,  -- amount (GHS) for fixed; percentage for percent types
  starts_on    date not null,
  ends_on      date not null,
  is_active    boolean not null default true,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  check (ends_on >= starts_on)
);

comment on table rate_overrides is
  'Seasonal / promotional rate overrides per room category and date range.';

-- RLS: tenant members can manage their own overrides
alter table rate_overrides enable row level security;

create policy "rate_overrides_tenant_select" on rate_overrides
  for select using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = rate_overrides.tenant_id
        and tm.user_id   = auth.uid()
        and tm.is_active = true
    )
  );

create policy "rate_overrides_tenant_insert" on rate_overrides
  for insert with check (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = rate_overrides.tenant_id
        and tm.user_id   = auth.uid()
        and tm.is_active = true
        and tm.role in ('owner', 'manager')
    )
  );

create policy "rate_overrides_tenant_update" on rate_overrides
  for update using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = rate_overrides.tenant_id
        and tm.user_id   = auth.uid()
        and tm.is_active = true
        and tm.role in ('owner', 'manager')
    )
  );

create policy "rate_overrides_tenant_delete" on rate_overrides
  for delete using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = rate_overrides.tenant_id
        and tm.user_id   = auth.uid()
        and tm.is_active = true
        and tm.role in ('owner', 'manager')
    )
  );

-- Indexes
create index on rate_overrides (tenant_id);
create index on rate_overrides (category_id);
create index on rate_overrides (tenant_id, starts_on, ends_on) where is_active = true;

create trigger rate_overrides_updated_at
  before update on rate_overrides
  for each row execute function set_updated_at();
