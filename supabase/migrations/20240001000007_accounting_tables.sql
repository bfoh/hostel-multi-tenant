-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 008 — Double-Entry Accounting Engine
-- Ghana-compliant: VAT 15%, NHIL 2.5%, GETFund 2.5%, PAYE, SSNIT
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Enums ────────────────────────────────────────────────────────────────────

create type account_type as enum (
  'asset', 'liability', 'equity', 'revenue', 'expense'
);

create type journal_source as enum (
  'booking_payment', 'payroll', 'expense', 'refund', 'manual', 'bank_reconciliation'
);

-- ── Chart of accounts ─────────────────────────────────────────────────────────

create table chart_of_accounts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  code        text not null,                -- "1020", "4010"
  name        text not null,                -- "Cash at Bank"
  type        account_type not null,
  is_system   boolean not null default false, -- seeded by platform, not deletable
  is_active   boolean not null default true,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),

  unique (tenant_id, code)
);

create index on chart_of_accounts (tenant_id, type);
create index on chart_of_accounts (tenant_id, is_active);

-- ── Journal entries (header) ──────────────────────────────────────────────────

create table journal_entries (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  entry_date   date not null default current_date,
  reference    text,                          -- "BP-00123", "PR-2025-01"
  description  text not null,
  source       journal_source not null default 'manual',
  source_id    uuid,                          -- FK to booking_payments.id / payroll_runs.id etc.
  posted_by    uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

create index on journal_entries (tenant_id, entry_date desc);
create index on journal_entries (tenant_id, source, source_id);

-- ── Journal lines (debit / credit) ────────────────────────────────────────────

create table journal_lines (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references journal_entries(id) on delete cascade,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  account_id  uuid not null references chart_of_accounts(id),
  description text,
  debit       integer not null default 0 check (debit  >= 0),  -- pesewas
  credit      integer not null default 0 check (credit >= 0),  -- pesewas
  created_at  timestamptz not null default now(),

  check (debit > 0 or credit > 0),
  check (not (debit > 0 and credit > 0))       -- a line is either DR or CR
);

create index on journal_lines (entry_id);
create index on journal_lines (tenant_id, account_id);

-- ── Seed Ghana Chart of Accounts for each new tenant ─────────────────────────

create or replace function seed_ghana_coa(p_tenant_id uuid)
returns void language plpgsql as $$
begin
  insert into chart_of_accounts (tenant_id, code, name, type, is_system, sort_order) values
    -- ── Assets (1xxx) ───────────────────────────────────────────────────────
    (p_tenant_id, '1010', 'Cash on Hand',               'asset',     true,  10),
    (p_tenant_id, '1020', 'Cash at Bank / MoMo',        'asset',     true,  20),
    (p_tenant_id, '1100', 'Accounts Receivable',        'asset',     true,  30),
    (p_tenant_id, '1200', 'Prepaid Expenses',           'asset',     false, 40),
    (p_tenant_id, '1300', 'Inventory / Supplies',      'asset',     false, 50),
    (p_tenant_id, '1500', 'Property & Equipment',      'asset',     false, 60),
    (p_tenant_id, '1510', 'Accum. Depreciation',       'asset',     false, 70),
    -- ── Liabilities (2xxx) ──────────────────────────────────────────────────
    (p_tenant_id, '2010', 'Accounts Payable',           'liability', true,  110),
    (p_tenant_id, '2100', 'VAT Payable (15%)',          'liability', true,  120),
    (p_tenant_id, '2110', 'NHIL Payable (2.5%)',        'liability', true,  130),
    (p_tenant_id, '2120', 'GETFund Payable (2.5%)',     'liability', true,  140),
    (p_tenant_id, '2200', 'PAYE Tax Payable',           'liability', true,  150),
    (p_tenant_id, '2210', 'SSNIT Payable — Employer',  'liability', true,  160),
    (p_tenant_id, '2220', 'SSNIT Payable — Employee',  'liability', true,  170),
    (p_tenant_id, '2300', 'Unearned Revenue (Deposits)','liability', false, 180),
    -- ── Equity (3xxx) ───────────────────────────────────────────────────────
    (p_tenant_id, '3000', 'Owner''s Capital',           'equity',    false, 210),
    (p_tenant_id, '3100', 'Retained Earnings',          'equity',    false, 220),
    -- ── Revenue (4xxx) ──────────────────────────────────────────────────────
    (p_tenant_id, '4010', 'Room Revenue',               'revenue',   true,  310),
    (p_tenant_id, '4020', 'Laundry Income',             'revenue',   false, 320),
    (p_tenant_id, '4030', 'Other Income',               'revenue',   false, 330),
    -- ── Expenses (5xxx) ─────────────────────────────────────────────────────
    (p_tenant_id, '5010', 'Staff Salaries & Wages',     'expense',   true,  410),
    (p_tenant_id, '5020', 'Utilities (Water, Power)',   'expense',   false, 420),
    (p_tenant_id, '5030', 'Maintenance & Repairs',      'expense',   false, 430),
    (p_tenant_id, '5040', 'Cleaning Supplies',          'expense',   false, 440),
    (p_tenant_id, '5050', 'Administrative Expenses',    'expense',   false, 450),
    (p_tenant_id, '5060', 'Marketing & Advertising',    'expense',   false, 460),
    (p_tenant_id, '5100', 'Depreciation',               'expense',   false, 470),
    (p_tenant_id, '5200', 'SSNIT Contribution (Emplr)', 'expense',   true,  480)
  on conflict (tenant_id, code) do nothing;
end;
$$;

-- ── Seed COA for all existing tenants ────────────────────────────────────────

do $$
declare
  t record;
begin
  for t in select id from tenants loop
    perform seed_ghana_coa(t.id);
  end loop;
end;
$$;

-- ── Auto-seed COA for new tenants ─────────────────────────────────────────────

create or replace function on_tenant_created()
returns trigger language plpgsql as $$
begin
  perform seed_ghana_coa(new.id);
  return new;
end;
$$;

create trigger tenant_coa_seed
  after insert on tenants
  for each row execute function on_tenant_created();

-- ── Auto-journal on booking_payment posted ────────────────────────────────────
-- Cash-basis: DR Cash at Bank / CR Room Revenue

create or replace function journal_booking_payment()
returns trigger language plpgsql as $$
declare
  v_entry_id  uuid;
  v_cash_id   uuid;
  v_rev_id    uuid;
  v_booking   record;
begin
  -- Only journal when status flips to 'paid'
  if new.status <> 'paid' then
    return new;
  end if;
  if old is not null and old.status = 'paid' then
    return new;  -- already journaled
  end if;

  -- Resolve system accounts
  select id into v_cash_id from chart_of_accounts
    where tenant_id = new.tenant_id and code = '1020' limit 1;
  select id into v_rev_id  from chart_of_accounts
    where tenant_id = new.tenant_id and code = '4010' limit 1;

  if v_cash_id is null or v_rev_id is null then
    return new;  -- COA not seeded yet — skip
  end if;

  -- Fetch booking ref for description
  select booking_ref into v_booking from bookings where id = new.booking_id limit 1;

  -- Create journal entry header
  insert into journal_entries
    (tenant_id, entry_date, reference, description, source, source_id)
  values
    (new.tenant_id, coalesce(new.paid_at::date, current_date),
     coalesce(v_booking.booking_ref, new.id::text),
     'Room revenue — payment received',
     'booking_payment', new.id)
  returning id into v_entry_id;

  -- DR Cash at Bank
  insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
  values (v_entry_id, new.tenant_id, v_cash_id, new.amount, 0);

  -- CR Room Revenue
  insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
  values (v_entry_id, new.tenant_id, v_rev_id, 0, new.amount);

  return new;
end;
$$;

create trigger booking_payment_journal
  after insert or update of status on booking_payments
  for each row execute function journal_booking_payment();

-- ── Auto-journal on payroll run approved ─────────────────────────────────────
-- DR Salaries Expense / DR SSNIT Expense (employer) / CR PAYE Payable / CR SSNIT Payable / CR Cash

create or replace function journal_payroll_run()
returns trigger language plpgsql as $$
declare
  v_entry_id        uuid;
  v_salary_id       uuid;
  v_ssnit_exp_id    uuid;
  v_cash_id         uuid;
  v_paye_payable_id uuid;
  v_ssnit_empr_id   uuid;
  v_ssnit_empe_id   uuid;
  v_total_gross     integer;
  v_total_ssnit_empr integer;
  v_total_paye      integer;
  v_total_net       integer;
begin
  -- Only journal when status flips to 'paid'
  if new.status <> 'paid' then
    return new;
  end if;
  if old is not null and old.status = 'paid' then
    return new;
  end if;

  -- Resolve accounts
  select id into v_salary_id    from chart_of_accounts where tenant_id = new.tenant_id and code = '5010' limit 1;
  select id into v_ssnit_exp_id from chart_of_accounts where tenant_id = new.tenant_id and code = '5200' limit 1;
  select id into v_cash_id      from chart_of_accounts where tenant_id = new.tenant_id and code = '1020' limit 1;
  select id into v_paye_payable_id from chart_of_accounts where tenant_id = new.tenant_id and code = '2200' limit 1;
  select id into v_ssnit_empr_id  from chart_of_accounts where tenant_id = new.tenant_id and code = '2210' limit 1;
  select id into v_ssnit_empe_id  from chart_of_accounts where tenant_id = new.tenant_id and code = '2220' limit 1;

  if v_salary_id is null then return new; end if;

  -- Aggregate from payroll items
  select
    coalesce(sum(basic_salary + allowances), 0),
    coalesce(sum(ssnit_employer), 0),
    coalesce(sum(paye_tax), 0),
    coalesce(sum(net_salary), 0)
  into v_total_gross, v_total_ssnit_empr, v_total_paye, v_total_net
  from payroll_items where payroll_run_id = new.id;

  -- Journal entry header
  insert into journal_entries
    (tenant_id, entry_date, reference, description, source, source_id)
  values
    (new.tenant_id, current_date,
     new.period_start::text || '/' || new.period_end::text,
     'Payroll — ' || to_char(new.period_start, 'Mon YYYY'),
     'payroll', new.id)
  returning id into v_entry_id;

  -- DR Salaries expense (gross + employer SSNIT)
  insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
  values (v_entry_id, new.tenant_id, v_salary_id, v_total_gross, 0);

  if v_ssnit_exp_id is not null then
    insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
    values (v_entry_id, new.tenant_id, v_ssnit_exp_id, v_total_ssnit_empr, 0);
  end if;

  -- CR PAYE Payable
  if v_paye_payable_id is not null and v_total_paye > 0 then
    insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
    values (v_entry_id, new.tenant_id, v_paye_payable_id, 0, v_total_paye);
  end if;

  -- CR SSNIT Payable Employer
  if v_ssnit_empr_id is not null and v_total_ssnit_empr > 0 then
    insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
    values (v_entry_id, new.tenant_id, v_ssnit_empr_id, 0, v_total_ssnit_empr);
  end if;

  -- CR SSNIT Payable Employee (from payroll items)
  declare
    v_total_ssnit_empe integer;
  begin
    select coalesce(sum(ssnit_employee), 0) into v_total_ssnit_empe
    from payroll_items where payroll_run_id = new.id;

    if v_ssnit_empe_id is not null and v_total_ssnit_empe > 0 then
      insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
      values (v_entry_id, new.tenant_id, v_ssnit_empe_id, 0, v_total_ssnit_empe);
    end if;
  end;

  -- CR Cash (net pay disbursed)
  if v_cash_id is not null and v_total_net > 0 then
    insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
    values (v_entry_id, new.tenant_id, v_cash_id, 0, v_total_net);
  end if;

  return new;
end;
$$;

create trigger payroll_run_journal
  after insert or update of status on payroll_runs
  for each row execute function journal_payroll_run();

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table chart_of_accounts enable row level security;
alter table journal_entries    enable row level security;
alter table journal_lines      enable row level security;

-- All tenant members can read accounting data
create policy "tenant_read_coa"
  on chart_of_accounts for select
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );

create policy "tenant_read_journal_entries"
  on journal_entries for select
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );

create policy "tenant_read_journal_lines"
  on journal_lines for select
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );

-- Owners/managers/accountants can insert/update
create policy "tenant_write_coa"
  on chart_of_accounts for all
  using (
    tenant_id in (
      select tenant_id from tenant_members
      where user_id = auth.uid()
      and role in ('owner', 'manager', 'accountant')
    )
  );

create policy "tenant_write_journal_entries"
  on journal_entries for all
  using (
    tenant_id in (
      select tenant_id from tenant_members
      where user_id = auth.uid()
      and role in ('owner', 'manager', 'accountant')
    )
  );

create policy "tenant_write_journal_lines"
  on journal_lines for all
  using (
    tenant_id in (
      select tenant_id from tenant_members
      where user_id = auth.uid()
      and role in ('owner', 'manager', 'accountant')
    )
  );
