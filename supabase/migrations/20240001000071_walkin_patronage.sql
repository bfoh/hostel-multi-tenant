-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 071 — Walk-in patronage (gym / sports / laundry / restaurant)
--
-- Adds the schema needed for QR-driven walk-in flows at each revenue point.
--
--   1. revenue_point_visitors  — light CRM (auto-upserted by phone on each
--                                public sale). Linked to occupants when
--                                phone matches an existing occupant.
--   2. revenue_point_sales     — extra columns to capture walk-in context:
--                                visitor_id, table_number, weight_kg,
--                                duration_minutes, entry_token, status.
--   3. revenue_points          — public_enabled flag + per-type
--                                public_config jsonb.
--
-- All additions are non-destructive: existing rows are unaffected,
-- existing checks/triggers remain intact.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Visitor registry ─────────────────────────────────────────────────────

create table if not exists revenue_point_visitors (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  phone          text not null,
  first_name     text,
  last_name      text,
  email          text,
  occupant_id    uuid references occupants(id) on delete set null,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  visit_count    int not null default 0,
  total_spend    bigint not null default 0,                -- pesewas
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint revenue_point_visitors_phone_per_tenant unique (tenant_id, phone)
);

create trigger revenue_point_visitors_updated_at
  before update on revenue_point_visitors
  for each row execute function set_updated_at();

create index on revenue_point_visitors (tenant_id, last_seen_at desc);
create index on revenue_point_visitors (occupant_id) where occupant_id is not null;

alter table revenue_point_visitors enable row level security;

create policy "tenant members can manage revenue point visitors"
  on revenue_point_visitors for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );

-- ── 2. revenue_point_sales — walk-in metadata ───────────────────────────────

alter table revenue_point_sales
  add column if not exists visitor_id        uuid references revenue_point_visitors(id) on delete set null,
  add column if not exists table_number      text,
  add column if not exists weight_kg         numeric(6,2),
  add column if not exists duration_minutes  int,
  add column if not exists court_id          text,
  add column if not exists entry_token       text,
  add column if not exists status            text not null default 'completed';

create index if not exists idx_revenue_point_sales_court_active
  on revenue_point_sales (tenant_id, revenue_point_id, court_id, sold_at)
  where court_id is not null;

-- Laundry uses: received → washing → ready → collected.
-- Gym/sports/restaurant default to 'completed' on payment success.
alter table revenue_point_sales
  drop constraint if exists revenue_point_sales_status_check;
alter table revenue_point_sales
  add constraint revenue_point_sales_status_check
  check (status in ('completed','received','washing','ready','collected','cancelled'));

create index if not exists idx_revenue_point_sales_entry_token
  on revenue_point_sales (tenant_id, entry_token)
  where entry_token is not null;

create index if not exists idx_revenue_point_sales_visitor
  on revenue_point_sales (visitor_id)
  where visitor_id is not null;

create index if not exists idx_revenue_point_sales_status_open
  on revenue_point_sales (tenant_id, revenue_point_id, status)
  where status in ('received','washing','ready');

-- ── 3. revenue_points — public walk-in config ───────────────────────────────

alter table revenue_points
  add column if not exists public_enabled  boolean not null default false,
  add column if not exists public_config   jsonb not null default '{}'::jsonb;

comment on column revenue_points.public_config is
  'Per-type walk-in configuration:
   gym:        { day_pass_price: int(pesewas), includes: text[] }
   sports:     { courts: [{ id, name, hourly_rate }], min_minutes: int }
   laundry:    { rate_per_kg: int(pesewas), min_charge: int(pesewas), turnaround_hours: int }
   restaurant: { tables: text[], pickup_allowed: bool }';

-- ── 4. food_orders ──────────────────────────────────────────────────────────
-- table_label already exists from migration 062; no additional column needed.
-- The walk-in restaurant flow re-uses the existing column.
