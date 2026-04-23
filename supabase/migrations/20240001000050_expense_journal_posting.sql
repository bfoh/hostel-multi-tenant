-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 050 — Post expenses to the double-entry ledger
--
-- Closes the gap where `expenses` rows bypassed the general journal, making
-- P&L, Trial Balance, Cash Flow, and Balance Sheet wrong.
--
-- On insert:  DR expense account (by category) / CR cash account (by method)
-- On update:  reverse prior JE for that expense + repost
-- On delete:  reverse prior JE for that expense
--
-- Plus: adds 5070/5080/5090 expense accounts and backfills existing rows.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Extend Chart of Accounts seed with new expense codes ────────────────

create or replace function seed_ghana_coa(p_tenant_id uuid)
returns void language plpgsql as $$
begin
  insert into chart_of_accounts (tenant_id, code, name, type, is_system, sort_order) values
    -- ── Assets (1xxx) ─────────────────────────────────────────────────────
    (p_tenant_id, '1010', 'Cash on Hand',               'asset',     true,  10),
    (p_tenant_id, '1020', 'Cash at Bank / MoMo',        'asset',     true,  20),
    (p_tenant_id, '1100', 'Accounts Receivable',        'asset',     true,  30),
    (p_tenant_id, '1200', 'Prepaid Expenses',           'asset',     false, 40),
    (p_tenant_id, '1300', 'Inventory / Supplies',       'asset',     false, 50),
    (p_tenant_id, '1500', 'Property & Equipment',       'asset',     false, 60),
    (p_tenant_id, '1510', 'Accum. Depreciation',        'asset',     false, 70),
    -- ── Liabilities (2xxx) ────────────────────────────────────────────────
    (p_tenant_id, '2010', 'Accounts Payable',           'liability', true,  110),
    (p_tenant_id, '2100', 'VAT Payable (15%)',          'liability', true,  120),
    (p_tenant_id, '2110', 'NHIL Payable (2.5%)',        'liability', true,  130),
    (p_tenant_id, '2120', 'GETFund Payable (2.5%)',     'liability', true,  140),
    (p_tenant_id, '2200', 'PAYE Tax Payable',           'liability', true,  150),
    (p_tenant_id, '2210', 'SSNIT Payable — Employer',   'liability', true,  160),
    (p_tenant_id, '2220', 'SSNIT Payable — Employee',   'liability', true,  170),
    (p_tenant_id, '2300', 'Unearned Revenue (Deposits)','liability', false, 180),
    -- ── Equity (3xxx) ─────────────────────────────────────────────────────
    (p_tenant_id, '3000', 'Owner''s Capital',           'equity',    false, 210),
    (p_tenant_id, '3100', 'Retained Earnings',          'equity',    false, 220),
    -- ── Revenue (4xxx) ────────────────────────────────────────────────────
    (p_tenant_id, '4010', 'Room Revenue',               'revenue',   true,  310),
    (p_tenant_id, '4020', 'Laundry Income',             'revenue',   false, 320),
    (p_tenant_id, '4030', 'Other Income',               'revenue',   false, 330),
    -- ── Expenses (5xxx) ───────────────────────────────────────────────────
    (p_tenant_id, '5010', 'Staff Salaries & Wages',     'expense',   true,  410),
    (p_tenant_id, '5020', 'Utilities (Water, Power)',   'expense',   false, 420),
    (p_tenant_id, '5030', 'Maintenance & Repairs',      'expense',   false, 430),
    (p_tenant_id, '5040', 'Cleaning Supplies',          'expense',   false, 440),
    (p_tenant_id, '5050', 'Administrative Expenses',    'expense',   false, 450),
    (p_tenant_id, '5060', 'Marketing & Advertising',    'expense',   false, 460),
    (p_tenant_id, '5070', 'Insurance',                  'expense',   false, 465),
    (p_tenant_id, '5080', 'Rent',                       'expense',   false, 468),
    (p_tenant_id, '5090', 'Equipment & Tools',          'expense',   false, 469),
    (p_tenant_id, '5100', 'Depreciation',               'expense',   false, 470),
    (p_tenant_id, '5200', 'SSNIT Contribution (Emplr)', 'expense',   true,  480)
  on conflict (tenant_id, code) do nothing;
end;
$$;

-- Backfill new codes for every existing tenant.
do $$
declare
  t record;
begin
  for t in select id from tenants loop
    perform seed_ghana_coa(t.id);
  end loop;
end;
$$;

-- ── 2. Helpers: category → expense account, payment_method → cash account ──

create or replace function expense_category_to_code(p_category text)
returns text language sql immutable as $$
  select case p_category
    when 'utilities'   then '5020'
    when 'repairs'     then '5030'
    when 'maintenance' then '5030'
    when 'salaries'    then '5010'
    when 'supplies'    then '5040'
    when 'marketing'   then '5060'
    when 'insurance'   then '5070'
    when 'rent'        then '5080'
    when 'equipment'   then '5090'
    else                    '5050'  -- 'other' or unknown
  end
$$;

create or replace function payment_method_to_cash_code(p_method text)
returns text language sql immutable as $$
  select case p_method
    when 'cash' then '1010'        -- Cash on Hand
    else             '1020'        -- Bank / MoMo / card / cheque / null
  end
$$;

-- ── 3. Trigger function: post / repost / reverse journal entry for an expense

create or replace function journal_expense_post()
returns trigger language plpgsql as $$
declare
  v_entry_id    uuid;
  v_exp_code    text;
  v_cash_code   text;
  v_exp_acct_id uuid;
  v_cash_id     uuid;
  v_tenant_id   uuid;
  v_amount      integer;
  v_date        date;
  v_desc        text;
  v_source_id   uuid;
begin
  -- Always remove any previously posted JE for this expense (idempotent)
  if TG_OP in ('UPDATE', 'DELETE') then
    delete from journal_entries
     where source    = 'expense'
       and source_id = old.id;
  end if;

  -- Nothing more to do on DELETE.
  if TG_OP = 'DELETE' then
    return old;
  end if;

  v_tenant_id := new.tenant_id;
  v_amount    := new.amount;
  v_date      := new.expense_date;
  v_source_id := new.id;
  v_desc      := new.category || ' — ' || coalesce(new.vendor, new.description);

  -- Resolve account codes
  v_exp_code  := expense_category_to_code(new.category);
  v_cash_code := payment_method_to_cash_code(new.payment_method);

  select id into v_exp_acct_id
    from chart_of_accounts
   where tenant_id = v_tenant_id
     and code      = v_exp_code
   limit 1;

  select id into v_cash_id
    from chart_of_accounts
   where tenant_id = v_tenant_id
     and code      = v_cash_code
   limit 1;

  -- If the COA has not been seeded for this tenant, skip silently so the
  -- expense insert does not fail. The ledger simply won't reflect it.
  if v_exp_acct_id is null or v_cash_id is null then
    return new;
  end if;

  -- Create journal entry header
  insert into journal_entries
    (tenant_id, entry_date, reference, description, source, source_id)
  values
    (v_tenant_id, v_date, new.reference, v_desc, 'expense', v_source_id)
  returning id into v_entry_id;

  -- DR expense account
  insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
  values (v_entry_id, v_tenant_id, v_exp_acct_id, v_amount, 0);

  -- CR cash account
  insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
  values (v_entry_id, v_tenant_id, v_cash_id, 0, v_amount);

  return new;
end;
$$;

drop trigger if exists expense_journal on expenses;

create trigger expense_journal
  after insert or update or delete on expenses
  for each row execute function journal_expense_post();

-- ── 4. Backfill: post JE for every expense that is not yet on the ledger ───

do $$
declare
  e record;
begin
  for e in
    select x.*
      from expenses x
     where not exists (
       select 1 from journal_entries je
        where je.source    = 'expense'
          and je.source_id = x.id
     )
  loop
    declare
      v_entry_id    uuid;
      v_exp_acct_id uuid;
      v_cash_id     uuid;
      v_exp_code    text := expense_category_to_code(e.category);
      v_cash_code   text := payment_method_to_cash_code(e.payment_method);
      v_desc        text := e.category || ' — ' || coalesce(e.vendor, e.description);
    begin
      select id into v_exp_acct_id from chart_of_accounts
        where tenant_id = e.tenant_id and code = v_exp_code limit 1;
      select id into v_cash_id     from chart_of_accounts
        where tenant_id = e.tenant_id and code = v_cash_code limit 1;

      if v_exp_acct_id is null or v_cash_id is null then
        continue;
      end if;

      insert into journal_entries
        (tenant_id, entry_date, reference, description, source, source_id)
      values
        (e.tenant_id, e.expense_date, e.reference, v_desc, 'expense', e.id)
      returning id into v_entry_id;

      insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
      values (v_entry_id, e.tenant_id, v_exp_acct_id, e.amount, 0);

      insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
      values (v_entry_id, e.tenant_id, v_cash_id, 0, e.amount);
    end;
  end loop;
end;
$$;
