-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 079 — Per-account monthly budgets (FP&A variance analysis)
--
-- One budget row per (tenant, account, year, month). Actuals come from
-- aggregating journal_lines at read-time — we don't snapshot them, so
-- restated entries flow through to variance automatically.
-- ═══════════════════════════════════════════════════════════════════════════

create table account_budgets (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  account_id   uuid not null references chart_of_accounts(id) on delete cascade,
  year         smallint not null check (year between 2000 and 2100),
  month        smallint not null check (month between 1 and 12),
  amount       integer not null check (amount >= 0),   -- pesewas
  notes        text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (tenant_id, account_id, year, month)
);

create index on account_budgets (tenant_id, year, month);
create index on account_budgets (tenant_id, account_id);

create trigger account_budgets_updated_at
  before update on account_budgets
  for each row execute function set_updated_at();

alter table account_budgets enable row level security;

create policy "tenant members read budgets"
  on account_budgets for select
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid()));
