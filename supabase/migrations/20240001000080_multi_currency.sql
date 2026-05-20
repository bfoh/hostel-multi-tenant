-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 080 — Multi-currency primitives
--
-- Tenant base currency stays GHS. fx_rates stores a per-tenant rate table
-- so each business can capture its own banking rates (the BoG mid-rate is
-- usually 1–3% off the rate suppliers actually transact at).
--
-- Transactional tables (supplier_bills today, extensible later) optionally
-- carry the foreign currency + the rate used at the time of capture so that
-- historical entries remain faithful even if rates are restated later.
-- ═══════════════════════════════════════════════════════════════════════════

create table fx_rates (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  currency_code   text not null,                            -- ISO 4217, e.g. 'USD'
  rate_to_base    numeric(14, 6) not null check (rate_to_base > 0),  -- 1 unit foreign = rate_to_base GHS
  as_of_date      date not null,
  source          text,                                     -- 'BoG', 'GCB', manual…
  notes           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),

  unique (tenant_id, currency_code, as_of_date)
);

create index on fx_rates (tenant_id, currency_code, as_of_date desc);

alter table fx_rates enable row level security;

create policy "tenant members read fx rates"
  on fx_rates for select
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid()));

-- ── Extend supplier_bills with original-currency capture ───────────────────
alter table supplier_bills
  add column if not exists currency_code  text default 'GHS',
  add column if not exists original_amount integer,            -- pesewas in original currency
  add column if not exists fx_rate_used    numeric(14, 6);     -- rate at capture time

comment on column supplier_bills.amount is
  'Base-currency (GHS) amount — derived from original_amount × fx_rate_used at capture if foreign currency';
