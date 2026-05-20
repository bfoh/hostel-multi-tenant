-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 081 — Asset depreciation
--
-- Extends `assets` with depreciation parameters and adds a depreciation_runs
-- ledger so the same month is never posted twice. Straight-line is the only
-- method seeded; the column accepts future methods (declining balance,
-- units-of-production) without another migration.
--
-- Monthly journal posted by the API:
--   DR 5100 Depreciation Expense   sum(monthly_depreciation)
--   CR 1510 Accumulated Depreciation sum(monthly_depreciation)
-- ═══════════════════════════════════════════════════════════════════════════

create type depreciation_method as enum ('straight_line');

alter table assets
  add column if not exists depreciation_method      depreciation_method not null default 'straight_line',
  add column if not exists useful_life_months       smallint check (useful_life_months > 0),
  add column if not exists salvage_value            integer not null default 0 check (salvage_value >= 0),
  add column if not exists accumulated_depreciation integer not null default 0 check (accumulated_depreciation >= 0),
  add column if not exists depreciation_start_date  date,
  add column if not exists last_depreciated_through date;

create table depreciation_runs (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  period_year      smallint not null check (period_year between 2000 and 2100),
  period_month     smallint not null check (period_month between 1 and 12),
  asset_count      integer not null default 0,
  total_amount     integer not null default 0 check (total_amount >= 0),  -- pesewas
  journal_entry_id uuid references journal_entries(id) on delete set null,
  posted_by        uuid references auth.users(id) on delete set null,
  posted_at        timestamptz not null default now(),

  unique (tenant_id, period_year, period_month)
);

create index on depreciation_runs (tenant_id, period_year desc, period_month desc);

alter table depreciation_runs enable row level security;

create policy "tenant members read depreciation runs"
  on depreciation_runs for select
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid()));
