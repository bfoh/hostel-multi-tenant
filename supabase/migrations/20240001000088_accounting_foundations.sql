-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 088 — Accounting foundations (suppliers, recurring entries,
--                  fiscal year, void/reverse, input VAT, tax filings,
--                  inventory movements)
--
-- Single broad migration so every downstream feature has its schema in
-- one shot. Each section is independent.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── §1 — Input VAT account (1400) seeded into every tenant's COA ──────────
insert into chart_of_accounts (tenant_id, code, name, type, is_system, sort_order)
select t.id, '1400', 'Input VAT Recoverable', 'asset', true, 55
from tenants t
on conflict (tenant_id, code) do nothing;

-- Extend seed_ghana_coa so future tenants get it
create or replace function seed_ghana_coa(p_tenant_id uuid)
returns void language plpgsql as $$
begin
  insert into chart_of_accounts (tenant_id, code, name, type, is_system, sort_order) values
    (p_tenant_id, '1010', 'Cash on Hand',               'asset',     true,  10),
    (p_tenant_id, '1020', 'Cash at Bank / MoMo',        'asset',     true,  20),
    (p_tenant_id, '1100', 'Accounts Receivable',        'asset',     true,  30),
    (p_tenant_id, '1200', 'Prepaid Expenses',           'asset',     false, 40),
    (p_tenant_id, '1300', 'Inventory / Supplies',       'asset',     false, 50),
    (p_tenant_id, '1400', 'Input VAT Recoverable',      'asset',     true,  55),
    (p_tenant_id, '1500', 'Property & Equipment',       'asset',     false, 60),
    (p_tenant_id, '1510', 'Accum. Depreciation',        'asset',     false, 70),
    (p_tenant_id, '2010', 'Accounts Payable',           'liability', true,  110),
    (p_tenant_id, '2100', 'VAT Payable (15%)',          'liability', true,  120),
    (p_tenant_id, '2110', 'NHIL Payable (2.5%)',        'liability', true,  130),
    (p_tenant_id, '2120', 'GETFund Payable (2.5%)',     'liability', true,  140),
    (p_tenant_id, '2200', 'PAYE Tax Payable',           'liability', true,  150),
    (p_tenant_id, '2210', 'SSNIT Payable — Employer',   'liability', true,  160),
    (p_tenant_id, '2220', 'SSNIT Payable — Employee',   'liability', true,  170),
    (p_tenant_id, '2300', 'Unearned Revenue (Deposits)','liability', false, 180),
    (p_tenant_id, '3000', 'Owner''s Capital',           'equity',    false, 210),
    (p_tenant_id, '3100', 'Retained Earnings',          'equity',    false, 220),
    (p_tenant_id, '4010', 'Room Revenue',               'revenue',   true,  310),
    (p_tenant_id, '4020', 'Laundry Income',             'revenue',   false, 320),
    (p_tenant_id, '4030', 'Other Income',               'revenue',   false, 330),
    (p_tenant_id, '4040', 'Unrealized FX Gain',         'revenue',   true,  340),
    (p_tenant_id, '5010', 'Staff Salaries & Wages',     'expense',   true,  410),
    (p_tenant_id, '5020', 'Utilities (Water, Power)',   'expense',   false, 420),
    (p_tenant_id, '5030', 'Maintenance & Repairs',      'expense',   false, 430),
    (p_tenant_id, '5040', 'Cleaning Supplies',          'expense',   false, 440),
    (p_tenant_id, '5050', 'Administrative Expenses',    'expense',   false, 450),
    (p_tenant_id, '5060', 'Marketing & Advertising',    'expense',   false, 460),
    (p_tenant_id, '5100', 'Depreciation',               'expense',   false, 470),
    (p_tenant_id, '5200', 'SSNIT Contribution (Emplr)', 'expense',   true,  480),
    (p_tenant_id, '5300', 'Unrealized FX Loss',         'expense',   true,  495)
  on conflict (tenant_id, code) do nothing;
end;
$$;

-- ── §2 — Suppliers master ──────────────────────────────────────────────────
create table suppliers (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  name             text not null,
  contact_name     text,
  phone            text,
  email            text,
  address          text,
  tin              text,                                           -- Ghana Tax Identification Number
  payment_terms_days integer not null default 30 check (payment_terms_days >= 0),
  default_expense_account_id uuid references chart_of_accounts(id) on delete set null,
  default_currency text not null default 'GHS',
  notes            text,
  is_active        boolean not null default true,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index on suppliers (tenant_id, is_active);
create index on suppliers (tenant_id, name);
create unique index on suppliers (tenant_id, lower(name)) where is_active = true;

create trigger suppliers_updated_at
  before update on suppliers
  for each row execute function set_updated_at();

alter table suppliers enable row level security;
create policy "tenant members read suppliers" on suppliers for select
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid()));

-- Link supplier_bills to suppliers (optional; vendor_name still works as free-text)
alter table supplier_bills
  add column if not exists supplier_id uuid references suppliers(id) on delete set null;

create index if not exists supplier_bills_supplier_idx on supplier_bills (tenant_id, supplier_id);

-- ── §3 — Recurring bills ───────────────────────────────────────────────────
create type recurring_frequency as enum ('monthly', 'quarterly', 'yearly');

create table recurring_bills (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  supplier_id         uuid references suppliers(id) on delete set null,
  vendor_name         text not null,
  description         text not null,
  category            text not null,
  amount              integer not null check (amount > 0),  -- pesewas
  expense_account_id  uuid references chart_of_accounts(id) on delete set null,
  frequency           recurring_frequency not null default 'monthly',
  day_of_month        smallint not null default 1 check (day_of_month between 1 and 31),
  due_day_offset      smallint not null default 30 check (due_day_offset >= 0),
  next_run_date       date not null,
  last_run_date       date,
  is_active           boolean not null default true,
  notes               text,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index on recurring_bills (tenant_id, is_active, next_run_date);

create trigger recurring_bills_updated_at
  before update on recurring_bills
  for each row execute function set_updated_at();

alter table recurring_bills enable row level security;
create policy "tenant members read recurring bills" on recurring_bills for select
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid()));

-- Track which run created a given bill
alter table supplier_bills
  add column if not exists generated_from_recurring_id uuid references recurring_bills(id) on delete set null;

-- ── §4 — Recurring journal entry templates ────────────────────────────────
create table recurring_journals (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  name            text not null,
  description     text not null,
  frequency       recurring_frequency not null default 'monthly',
  day_of_month    smallint not null default 1 check (day_of_month between 1 and 31),
  next_run_date   date not null,
  last_run_date   date,
  is_active       boolean not null default true,
  /* lines stored as JSONB: [{account_id, side: 'debit'|'credit', amount, description?}] */
  lines           jsonb not null,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index on recurring_journals (tenant_id, is_active, next_run_date);

create trigger recurring_journals_updated_at
  before update on recurring_journals
  for each row execute function set_updated_at();

alter table recurring_journals enable row level security;
create policy "tenant members read recurring journals" on recurring_journals for select
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid()));

-- Track which template produced an entry
alter table journal_entries
  add column if not exists generated_from_recurring_id uuid references recurring_journals(id) on delete set null;

-- ── §5 — Fiscal year config on tenants ────────────────────────────────────
alter table tenants
  add column if not exists fiscal_year_start_month smallint not null default 1
    check (fiscal_year_start_month between 1 and 12);

comment on column tenants.fiscal_year_start_month is
  'First month of the tenant''s fiscal year (1 = January). Most Ghanaian SMEs use the calendar year per GRA.';

-- ── §6 — Journal void / reverse ───────────────────────────────────────────
alter table journal_entries
  add column if not exists voided_at        timestamptz,
  add column if not exists voided_by        uuid references auth.users(id) on delete set null,
  add column if not exists void_reason      text,
  add column if not exists reverses_entry_id uuid references journal_entries(id) on delete set null;

create index on journal_entries (tenant_id, voided_at)
  where voided_at is not null;

-- ── §7 — Tax filings register ─────────────────────────────────────────────
create type tax_filing_status as enum ('pending', 'filed', 'overdue');
create type tax_filing_kind   as enum ('vat_levies', 'paye', 'ssnit', 'corporate');

create table tax_filings (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  kind                tax_filing_kind not null,
  period_year         smallint not null,
  period_month        smallint check (period_month between 1 and 12),  -- null for annual corporate
  due_date            date not null,
  filed_at            timestamptz,
  filed_by            uuid references auth.users(id) on delete set null,
  amount_due          integer,                                          -- pesewas snapshotted at filing
  reference           text,                                             -- GRA receipt number
  proof_url           text,                                             -- uploaded confirmation
  notes               text,
  status              tax_filing_status not null default 'pending',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (tenant_id, kind, period_year, period_month)
);

create index on tax_filings (tenant_id, due_date);

create trigger tax_filings_updated_at
  before update on tax_filings
  for each row execute function set_updated_at();

alter table tax_filings enable row level security;
create policy "tenant members read tax filings" on tax_filings for select
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid()));

-- ── §8 — Inventory movements (simple ledger over the 1300 account) ────────
create type inventory_movement_type as enum ('purchase', 'usage', 'adjustment', 'transfer');

create table inventory_items (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  name            text not null,
  unit            text not null default 'unit',
  reorder_point   integer not null default 0 check (reorder_point >= 0),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (tenant_id, name)
);

create trigger inventory_items_updated_at
  before update on inventory_items
  for each row execute function set_updated_at();

create table inventory_movements (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  item_id         uuid not null references inventory_items(id) on delete cascade,
  movement_type   inventory_movement_type not null,
  quantity        integer not null check (quantity <> 0),     -- positive = in, negative = out
  unit_cost       integer not null default 0 check (unit_cost >= 0),  -- pesewas per unit
  reference       text,                                       -- bill id, expense id, etc.
  notes           text,
  moved_at        date not null default current_date,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index on inventory_movements (tenant_id, item_id, moved_at desc);

alter table inventory_items     enable row level security;
alter table inventory_movements enable row level security;
create policy "tenant members read inventory items"     on inventory_items     for select
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid()));
create policy "tenant members read inventory movements" on inventory_movements for select
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid()));
