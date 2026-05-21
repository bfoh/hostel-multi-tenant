-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 086 — FX revaluation
--
-- Seeds Unrealized FX Gain (4040) and Unrealized FX Loss (5300) into every
-- tenant's chart of accounts and extends seed_ghana_coa() so new tenants
-- get them automatically. Adds revaluation_runs to record each posting so
-- the same as-of date can't be re-revalued.
--
-- The revaluation engine itself lives in the API layer
-- (apps/web/app/api/accounting/fx/revalue/route.ts) — it scans open
-- supplier_bills in foreign currency, computes the GHS delta between the
-- captured rate and the latest rate, and posts ONE composite journal
-- entry per run:
--    For each unrealized loss row:  DR 5300 / CR 2010
--    For each unrealized gain row:  DR 2010 / CR 4040
-- ═══════════════════════════════════════════════════════════════════════════

-- Add the FX gain/loss accounts to any tenant that doesn't have them yet
insert into chart_of_accounts (tenant_id, code, name, type, is_system, sort_order)
select t.id, '4040', 'Unrealized FX Gain', 'revenue', true, 340
from tenants t
on conflict (tenant_id, code) do nothing;

insert into chart_of_accounts (tenant_id, code, name, type, is_system, sort_order)
select t.id, '5300', 'Unrealized FX Loss', 'expense', true, 495
from tenants t
on conflict (tenant_id, code) do nothing;

-- Update seed_ghana_coa() so future tenants get them
create or replace function seed_ghana_coa(p_tenant_id uuid)
returns void language plpgsql as $$
begin
  insert into chart_of_accounts (tenant_id, code, name, type, is_system, sort_order) values
    (p_tenant_id, '1010', 'Cash on Hand',               'asset',     true,  10),
    (p_tenant_id, '1020', 'Cash at Bank / MoMo',        'asset',     true,  20),
    (p_tenant_id, '1100', 'Accounts Receivable',        'asset',     true,  30),
    (p_tenant_id, '1200', 'Prepaid Expenses',           'asset',     false, 40),
    (p_tenant_id, '1300', 'Inventory / Supplies',       'asset',     false, 50),
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

-- ── Revaluation run ledger ────────────────────────────────────────────────
create table fx_revaluation_runs (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  as_of_date        date not null,
  bill_count        integer not null default 0,
  total_gain        integer not null default 0 check (total_gain >= 0),    -- pesewas
  total_loss        integer not null default 0 check (total_loss >= 0),    -- pesewas
  net_adjustment    integer not null default 0,                            -- gain − loss
  journal_entry_id  uuid references journal_entries(id) on delete set null,
  posted_by         uuid references auth.users(id) on delete set null,
  posted_at         timestamptz not null default now(),

  unique (tenant_id, as_of_date)
);

create index on fx_revaluation_runs (tenant_id, as_of_date desc);

alter table fx_revaluation_runs enable row level security;

create policy "tenant members read fx revaluation runs"
  on fx_revaluation_runs for select
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid()));
