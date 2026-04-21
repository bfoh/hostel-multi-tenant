-- ═══════════════════════════════════════════════════════════════════════════
-- AbrempongHMS — All migrations 007 through 046
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Prerequisite: migrations 000–006 must already be applied.
--
-- NOTE: Run this entire file as one query. Uses IF NOT EXISTS / ON CONFLICT
-- where possible, but if you hit a duplicate policy error, just skip that
-- statement and continue.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 007: Double-Entry Accounting Engine
-- ═══════════════════════════════════════════════════════════════════════════

create type account_type as enum (
  'asset', 'liability', 'equity', 'revenue', 'expense'
);

create type journal_source as enum (
  'booking_payment', 'payroll', 'expense', 'refund', 'manual', 'bank_reconciliation'
);

create table chart_of_accounts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  code        text not null,
  name        text not null,
  type        account_type not null,
  is_system   boolean not null default false,
  is_active   boolean not null default true,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),

  unique (tenant_id, code)
);

create index on chart_of_accounts (tenant_id, type);
create index on chart_of_accounts (tenant_id, is_active);

create table journal_entries (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  entry_date   date not null default current_date,
  reference    text,
  description  text not null,
  source       journal_source not null default 'manual',
  source_id    uuid,
  posted_by    uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

create index on journal_entries (tenant_id, entry_date desc);
create index on journal_entries (tenant_id, source, source_id);

create table journal_lines (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references journal_entries(id) on delete cascade,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  account_id  uuid not null references chart_of_accounts(id),
  description text,
  debit       integer not null default 0 check (debit  >= 0),
  credit      integer not null default 0 check (credit >= 0),
  created_at  timestamptz not null default now(),

  check (debit > 0 or credit > 0),
  check (not (debit > 0 and credit > 0))
);

create index on journal_lines (entry_id);
create index on journal_lines (tenant_id, account_id);

create or replace function seed_ghana_coa(p_tenant_id uuid)
returns void language plpgsql as $$
begin
  insert into chart_of_accounts (tenant_id, code, name, type, is_system, sort_order) values
    (p_tenant_id, '1010', 'Cash on Hand',               'asset',     true,  10),
    (p_tenant_id, '1020', 'Cash at Bank / MoMo',        'asset',     true,  20),
    (p_tenant_id, '1100', 'Accounts Receivable',        'asset',     true,  30),
    (p_tenant_id, '1200', 'Prepaid Expenses',           'asset',     false, 40),
    (p_tenant_id, '1300', 'Inventory / Supplies',      'asset',     false, 50),
    (p_tenant_id, '1500', 'Property & Equipment',      'asset',     false, 60),
    (p_tenant_id, '1510', 'Accum. Depreciation',       'asset',     false, 70),
    (p_tenant_id, '2010', 'Accounts Payable',           'liability', true,  110),
    (p_tenant_id, '2100', 'VAT Payable (15%)',          'liability', true,  120),
    (p_tenant_id, '2110', 'NHIL Payable (2.5%)',        'liability', true,  130),
    (p_tenant_id, '2120', 'GETFund Payable (2.5%)',     'liability', true,  140),
    (p_tenant_id, '2200', 'PAYE Tax Payable',           'liability', true,  150),
    (p_tenant_id, '2210', 'SSNIT Payable — Employer',  'liability', true,  160),
    (p_tenant_id, '2220', 'SSNIT Payable — Employee',  'liability', true,  170),
    (p_tenant_id, '2300', 'Unearned Revenue (Deposits)','liability', false, 180),
    (p_tenant_id, '3000', 'Owner''s Capital',           'equity',    false, 210),
    (p_tenant_id, '3100', 'Retained Earnings',          'equity',    false, 220),
    (p_tenant_id, '4010', 'Room Revenue',               'revenue',   true,  310),
    (p_tenant_id, '4020', 'Laundry Income',             'revenue',   false, 320),
    (p_tenant_id, '4030', 'Other Income',               'revenue',   false, 330),
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

do $$
declare
  t record;
begin
  for t in select id from tenants loop
    perform seed_ghana_coa(t.id);
  end loop;
end;
$$;

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

create or replace function journal_booking_payment()
returns trigger language plpgsql as $$
declare
  v_entry_id  uuid;
  v_cash_id   uuid;
  v_rev_id    uuid;
  v_booking   record;
begin
  if new.status <> 'paid' then
    return new;
  end if;
  if old is not null and old.status = 'paid' then
    return new;
  end if;

  select id into v_cash_id from chart_of_accounts
    where tenant_id = new.tenant_id and code = '1020' limit 1;
  select id into v_rev_id  from chart_of_accounts
    where tenant_id = new.tenant_id and code = '4010' limit 1;

  if v_cash_id is null or v_rev_id is null then
    return new;
  end if;

  select booking_ref into v_booking from bookings where id = new.booking_id limit 1;

  insert into journal_entries
    (tenant_id, entry_date, reference, description, source, source_id)
  values
    (new.tenant_id, coalesce(new.paid_at::date, current_date),
     coalesce(v_booking.booking_ref, new.id::text),
     'Room revenue — payment received',
     'booking_payment', new.id)
  returning id into v_entry_id;

  insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
  values (v_entry_id, new.tenant_id, v_cash_id, new.amount, 0);

  insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
  values (v_entry_id, new.tenant_id, v_rev_id, 0, new.amount);

  return new;
end;
$$;

create trigger booking_payment_journal
  after insert or update of status on booking_payments
  for each row execute function journal_booking_payment();

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
  if new.status <> 'paid' then
    return new;
  end if;
  if old is not null and old.status = 'paid' then
    return new;
  end if;

  select id into v_salary_id    from chart_of_accounts where tenant_id = new.tenant_id and code = '5010' limit 1;
  select id into v_ssnit_exp_id from chart_of_accounts where tenant_id = new.tenant_id and code = '5200' limit 1;
  select id into v_cash_id      from chart_of_accounts where tenant_id = new.tenant_id and code = '1020' limit 1;
  select id into v_paye_payable_id from chart_of_accounts where tenant_id = new.tenant_id and code = '2200' limit 1;
  select id into v_ssnit_empr_id  from chart_of_accounts where tenant_id = new.tenant_id and code = '2210' limit 1;
  select id into v_ssnit_empe_id  from chart_of_accounts where tenant_id = new.tenant_id and code = '2220' limit 1;

  if v_salary_id is null then return new; end if;

  select
    coalesce(sum(basic_salary + allowances), 0),
    coalesce(sum(ssnit_employer), 0),
    coalesce(sum(paye_tax), 0),
    coalesce(sum(net_salary), 0)
  into v_total_gross, v_total_ssnit_empr, v_total_paye, v_total_net
  from payroll_items where payroll_run_id = new.id;

  insert into journal_entries
    (tenant_id, entry_date, reference, description, source, source_id)
  values
    (new.tenant_id, current_date,
     new.period_start::text || '/' || new.period_end::text,
     'Payroll — ' || to_char(new.period_start, 'Mon YYYY'),
     'payroll', new.id)
  returning id into v_entry_id;

  insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
  values (v_entry_id, new.tenant_id, v_salary_id, v_total_gross, 0);

  if v_ssnit_exp_id is not null then
    insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
    values (v_entry_id, new.tenant_id, v_ssnit_exp_id, v_total_ssnit_empr, 0);
  end if;

  if v_paye_payable_id is not null and v_total_paye > 0 then
    insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
    values (v_entry_id, new.tenant_id, v_paye_payable_id, 0, v_total_paye);
  end if;

  if v_ssnit_empr_id is not null and v_total_ssnit_empr > 0 then
    insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
    values (v_entry_id, new.tenant_id, v_ssnit_empr_id, 0, v_total_ssnit_empr);
  end if;

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

alter table chart_of_accounts enable row level security;
alter table journal_entries    enable row level security;
alter table journal_lines      enable row level security;

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


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 008: GRA-Compliant Invoice Tax Fields
-- ═══════════════════════════════════════════════════════════════════════════

alter table tenants
  add column if not exists tin              text,
  add column if not exists vat_reg_number   text,
  add column if not exists is_vat_registered boolean not null default false;

alter table bookings
  add column if not exists vat_amount      integer not null default 0 check (vat_amount >= 0),
  add column if not exists nhil_amount     integer not null default 0 check (nhil_amount >= 0),
  add column if not exists getfund_amount  integer not null default 0 check (getfund_amount >= 0);

update bookings
set
  vat_amount     = round(tax_amount * 0.75)::integer,
  nhil_amount    = round(tax_amount * 0.125)::integer,
  getfund_amount = round(tax_amount * 0.125)::integer
where tax_amount > 0
  and vat_amount = 0
  and nhil_amount = 0
  and getfund_amount = 0;

alter table bookings
  add column if not exists invoice_number text;

create or replace function generate_invoice_number(p_tenant_id uuid)
returns text language plpgsql as $$
declare
  v_year  text;
  v_seq   integer;
begin
  v_year := to_char(now(), 'YYYY');

  select coalesce(max(
    case
      when invoice_number ~ ('^HMS-' || v_year || '-\d+$')
      then (regexp_match(invoice_number, '\d+$'))[1]::integer
      else 0
    end
  ), 0) + 1
  into v_seq
  from bookings
  where tenant_id = p_tenant_id;

  return 'HMS-' || v_year || '-' || lpad(v_seq::text, 5, '0');
end;
$$;

do $$
declare
  r record;
begin
  for r in
    select id, tenant_id, created_at
    from bookings
    where invoice_number is null
    order by tenant_id, created_at
  loop
    update bookings
    set invoice_number = generate_invoice_number(r.tenant_id)
    where id = r.id;
  end loop;
end;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 009: Bank Reconciliation
-- ═══════════════════════════════════════════════════════════════════════════

create type recon_status as enum ('unmatched', 'matched', 'excluded', 'manual');

create table bank_statements (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  upload_id    uuid not null,
  txn_date     date not null,
  description  text not null,
  debit        integer not null default 0,
  credit       integer not null default 0,
  balance      integer,
  reference    text,
  status       recon_status not null default 'unmatched',
  matched_entry_id uuid references journal_entries(id),
  matched_line_id  uuid references journal_lines(id),
  notes        text,
  uploaded_at  timestamptz not null default now(),

  check (debit >= 0 and credit >= 0),
  check (debit > 0 or credit > 0)
);

create index on bank_statements (tenant_id, status);
create index on bank_statements (tenant_id, txn_date desc);
create index on bank_statements (tenant_id, upload_id);

alter table bank_statements enable row level security;

create policy "tenant_read_bank_statements"
  on bank_statements for select
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid()));

create policy "tenant_write_bank_statements"
  on bank_statements for all
  using (
    tenant_id in (
      select tenant_id from tenant_members
      where user_id = auth.uid() and role in ('owner', 'manager', 'accountant')
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 010: Website CMS content
-- ═══════════════════════════════════════════════════════════════════════════

alter table tenants
  add column if not exists website_content jsonb not null default '{}'::jsonb;

comment on column tenants.website_content is
  'Structured CMS content for the hosted public booking page.
   Shape: { hero_heading, hero_subheading, about_text,
            amenities: string[], gallery_urls: string[],
            faqs: { q: string; a: string }[] }';


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 011: Onboarding completion flag
-- ═══════════════════════════════════════════════════════════════════════════

alter table tenants
  add column if not exists onboarding_completed boolean not null default false;

update tenants set onboarding_completed = true where onboarding_completed = false;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 012: Per-tenant AI agent configuration
-- ═══════════════════════════════════════════════════════════════════════════

alter table tenants
  add column if not exists ai_config jsonb not null default '{}'::jsonb;

comment on column tenants.ai_config is
  'Per-tenant AI chat agent settings.
   Shape: {
     ai_enabled:      boolean,
     agent_name:      string,
     personality:     "professional" | "friendly" | "casual",
     language:        "en" | "tw",
     custom_greeting: string | null,
     tools_enabled: {
       check_availability: boolean,
       get_pricing:        boolean,
       search_faqs:        boolean,
       escalate_to_human:  boolean
     }
   }';


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 013: Asset Register
-- ═══════════════════════════════════════════════════════════════════════════

create type asset_status as enum ('active', 'maintenance', 'disposed', 'lost');
create type asset_condition as enum ('excellent', 'good', 'fair', 'poor');

create table assets (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  name            text not null,
  category        text not null default 'general',
  description     text,
  brand           text,
  model           text,
  serial_number   text,
  qr_code         text not null unique,
  room_id         uuid references rooms(id) on delete set null,
  location_note   text,
  purchase_date   date,
  purchase_price  integer,
  supplier        text,
  warranty_expiry date,
  status          asset_status    not null default 'active',
  condition       asset_condition not null default 'good',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index on assets (tenant_id, status);
create index on assets (tenant_id, category);
create index on assets (tenant_id, room_id);
create unique index on assets (tenant_id, qr_code);

alter table assets enable row level security;

create policy "tenant_read_assets"
  on assets for select
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid()));

create policy "tenant_write_assets"
  on assets for all
  using (
    tenant_id in (
      select tenant_id from tenant_members
      where user_id = auth.uid() and role in ('owner', 'manager', 'accountant')
    )
  );

create or replace function touch_assets_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger assets_updated_at
  before update on assets
  for each row execute procedure touch_assets_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 014: Preventive Maintenance Schedules
-- ═══════════════════════════════════════════════════════════════════════════

create type pm_frequency as enum (
  'daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'biannual', 'annual'
);

create type pm_status as enum ('active', 'paused', 'archived');

create table pm_schedules (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 150),
  description     text,
  category        text not null default 'other'
                    check (category in ('plumbing','electrical','hvac','structural','furniture','appliance','cleaning','pest_control','security','other')),
  room_id         uuid references rooms(id) on delete set null,
  location_note   text,
  frequency       pm_frequency not null,
  interval_value  smallint not null default 1 check (interval_value >= 1),
  start_date      date not null,
  next_due_date   date not null,
  last_run_date   date,
  default_priority    text not null default 'medium'
                        check (default_priority in ('low','medium','high','urgent')),
  default_contractor_id uuid references contractors(id) on delete set null,
  estimated_cost_ghs  numeric(10,2),
  status          pm_status not null default 'active',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger pm_schedules_updated_at
  before update on pm_schedules
  for each row execute function set_updated_at();

create index on pm_schedules (tenant_id);
create index on pm_schedules (tenant_id, status);
create index on pm_schedules (tenant_id, next_due_date);

alter table pm_schedules enable row level security;

create policy "tenant members can manage pm schedules"
  on pm_schedules
  using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = pm_schedules.tenant_id
        and tm.user_id   = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = pm_schedules.tenant_id
        and tm.user_id   = auth.uid()
    )
  );

alter table maintenance_requests
  add column if not exists pm_schedule_id uuid references pm_schedules(id) on delete set null;

create index if not exists idx_maintenance_requests_pm_schedule_id on maintenance_requests (pm_schedule_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 015: Lost & Found Register
-- ═══════════════════════════════════════════════════════════════════════════

create type lf_status as enum ('unclaimed', 'claimed', 'disposed', 'donated');

create table lost_found_items (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  description   text not null check (char_length(description) between 1 and 500),
  category      text not null default 'other'
                  check (category in ('electronics','clothing','documents','keys','money','jewellery','bag','other')),
  found_date    date not null,
  found_location text,
  image_url     text,
  occupant_id   uuid references occupants(id) on delete set null,
  room_id       uuid references rooms(id) on delete set null,
  status        lf_status not null default 'unclaimed',
  claimed_by    text,
  claimed_at    timestamptz,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger lf_items_updated_at
  before update on lost_found_items
  for each row execute function set_updated_at();

create index on lost_found_items (tenant_id);
create index on lost_found_items (tenant_id, status);
create index on lost_found_items (tenant_id, found_date desc);

alter table lost_found_items enable row level security;

create policy "tenant members can manage lost & found"
  on lost_found_items
  using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = lost_found_items.tenant_id
        and tm.user_id   = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = lost_found_items.tenant_id
        and tm.user_id   = auth.uid()
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 016: Booking hold timer + Public API key
-- ═══════════════════════════════════════════════════════════════════════════

alter table bookings
  add column if not exists hold_expires_at timestamptz;

create index if not exists idx_bookings_hold_expires_at
  on bookings (hold_expires_at)
  where hold_expires_at is not null;

alter table tenants
  add column if not exists public_api_key text unique;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 017: Anomaly Detection Rules & Alerts
-- ═══════════════════════════════════════════════════════════════════════════

create type anomaly_severity as enum ('info', 'warning', 'critical');

create table anomaly_rules (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  metric      text not null,
  threshold   numeric not null,
  window_days smallint not null default 7,
  severity    anomaly_severity not null default 'warning',
  is_enabled  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger anomaly_rules_updated_at
  before update on anomaly_rules
  for each row execute function set_updated_at();

create index on anomaly_rules (tenant_id, is_enabled);

alter table anomaly_rules enable row level security;

create policy "tenant members can manage anomaly rules"
  on anomaly_rules
  using (exists (select 1 from tenant_members tm where tm.tenant_id = anomaly_rules.tenant_id and tm.user_id = auth.uid()))
  with check (exists (select 1 from tenant_members tm where tm.tenant_id = anomaly_rules.tenant_id and tm.user_id = auth.uid()));

create table anomaly_alerts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  rule_id     uuid references anomaly_rules(id) on delete set null,
  metric      text not null,
  severity    anomaly_severity not null,
  message     text not null,
  details     jsonb not null default '{}',
  sms_sent    boolean not null default false,
  sms_sent_at timestamptz,
  created_at  timestamptz not null default now()
);

create index on anomaly_alerts (tenant_id, created_at desc);
create index on anomaly_alerts (tenant_id, sms_sent) where sms_sent = false;

alter table anomaly_alerts enable row level security;

create policy "tenant members can view anomaly alerts"
  on anomaly_alerts
  using (exists (select 1 from tenant_members tm where tm.tenant_id = anomaly_alerts.tenant_id and tm.user_id = auth.uid()));

insert into anomaly_rules (tenant_id, name, metric, threshold, window_days, severity)
select
  id,
  'Revenue drop > 30%',
  'revenue_drop',
  30,
  7,
  'critical'
from tenants
on conflict do nothing;

insert into anomaly_rules (tenant_id, name, metric, threshold, window_days, severity)
select
  id,
  'Occupancy below 40%',
  'occupancy_low',
  40,
  1,
  'warning'
from tenants
on conflict do nothing;

insert into anomaly_rules (tenant_id, name, metric, threshold, window_days, severity)
select
  id,
  'No payments in 3 days',
  'payment_drought',
  3,
  3,
  'warning'
from tenants
on conflict do nothing;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 018: Booking OTPs (empty — skipped)
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 019: Paystack MoMo Payment Tracking
-- ═══════════════════════════════════════════════════════════════════════════

alter table bookings add column if not exists paystack_reference text;

create index if not exists idx_bookings_paystack_reference on bookings (paystack_reference) where paystack_reference is not null;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 020: Web Push Subscriptions
-- ═══════════════════════════════════════════════════════════════════════════

create table push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null,
  p256dh       text not null,
  auth_key     text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (tenant_id, user_id, endpoint)
);

create index on push_subscriptions (tenant_id);
create index on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

create policy "push_subscriptions_own"
  on push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger push_subscriptions_updated_at
  before update on push_subscriptions
  for each row execute function set_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 021: Housekeeping Tasks
-- ═══════════════════════════════════════════════════════════════════════════

create type hk_task_status   as enum ('pending', 'in_progress', 'done', 'skipped');
create type hk_task_priority as enum ('urgent', 'high', 'normal', 'low');

create table housekeeping_tasks (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  room_id      uuid not null references rooms(id) on delete cascade,
  assigned_to  uuid references staff_profiles(id) on delete set null,
  status       hk_task_status   not null default 'pending',
  priority     hk_task_priority not null default 'normal',
  notes        text,
  due_by       date,
  source       text default 'manual',
  booking_id   uuid references bookings(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index on housekeeping_tasks (tenant_id, status);
create index on housekeeping_tasks (room_id);
create index on housekeeping_tasks (assigned_to);
create index on housekeeping_tasks (due_by) where status != 'done';

alter table housekeeping_tasks enable row level security;

create policy "hk_tasks_tenant"
  on housekeeping_tasks for all
  using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = housekeeping_tasks.tenant_id
        and tm.user_id   = auth.uid()
        and tm.is_active = true
    )
  );

create trigger housekeeping_tasks_updated_at
  before update on housekeeping_tasks
  for each row execute function set_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 022: Platform admins (super-admin role)
-- ═══════════════════════════════════════════════════════════════════════════

create table platform_admins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table platform_admins is
  'Users with super-admin access to the platform operator panel.';

alter table platform_admins enable row level security;
create policy "platform_admins_service_only" on platform_admins
  using (false);

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql security definer as $$
declare
  claims      jsonb;
  member_rec  record;
  is_admin    boolean;
begin
  claims = coalesce(event -> 'claims', '{}'::jsonb);

  select tm.tenant_id, tm.role, t.slug
  into   member_rec
  from   tenant_members tm
  join   tenants t on t.id = tm.tenant_id
  where  tm.user_id = (event ->> 'user_id')::uuid
    and  tm.is_active = true
  limit  1;

  if found then
    claims = jsonb_set(claims, '{tenant_id}',   to_jsonb(member_rec.tenant_id::text));
    claims = jsonb_set(claims, '{tenant_role}',  to_jsonb(member_rec.role::text));
    claims = jsonb_set(claims, '{tenant_slug}',  to_jsonb(member_rec.slug));
  end if;

  select exists(
    select 1 from platform_admins where user_id = (event ->> 'user_id')::uuid
  ) into is_admin;

  if is_admin then
    claims = jsonb_set(claims, '{is_super_admin}', 'true'::jsonb);
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 023: Rate management & seasonal pricing
-- ═══════════════════════════════════════════════════════════════════════════

create table rate_overrides (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  category_id  uuid references room_categories(id) on delete cascade,
  name         text not null,
  rate_type    text not null default 'fixed'
               check (rate_type in ('fixed', 'percent_add', 'percent_off')),
  value        numeric(12,2) not null,
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

create index on rate_overrides (tenant_id);
create index on rate_overrides (category_id);
create index on rate_overrides (tenant_id, starts_on, ends_on) where is_active = true;

create trigger rate_overrides_updated_at
  before update on rate_overrides
  for each row execute function set_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 024: Installment payment plans
-- ═══════════════════════════════════════════════════════════════════════════

create table payment_plans (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  booking_id       uuid not null references bookings(id) on delete cascade,
  name             text not null,
  total_amount     numeric(12,2) not null,
  installments_count int not null check (installments_count between 2 and 12),
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  unique (booking_id)
);

create table payment_plan_installments (
  id                  uuid primary key default gen_random_uuid(),
  plan_id             uuid not null references payment_plans(id) on delete cascade,
  tenant_id           uuid not null references tenants(id) on delete cascade,
  installment_number  int not null,
  amount              numeric(12,2) not null,
  due_date            date not null,
  status              text not null default 'pending'
                      check (status in ('pending', 'paid', 'overdue', 'waived')),
  paid_at             timestamptz,
  payment_method      text,
  reference           text,
  notes               text,
  created_at          timestamptz not null default now()
);

alter table payment_plans enable row level security;
alter table payment_plan_installments enable row level security;

create policy "payment_plans_tenant" on payment_plans
  for all using (
    exists (select 1 from tenant_members tm
            where tm.tenant_id = payment_plans.tenant_id
              and tm.user_id = auth.uid() and tm.is_active = true)
  );

create policy "payment_plan_installments_tenant" on payment_plan_installments
  for all using (
    exists (select 1 from tenant_members tm
            where tm.tenant_id = payment_plan_installments.tenant_id
              and tm.user_id = auth.uid() and tm.is_active = true)
  );

create index on payment_plans (booking_id);
create index on payment_plan_installments (plan_id);
create index on payment_plan_installments (tenant_id, due_date) where status = 'pending';


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 025: Room waiting list
-- ═══════════════════════════════════════════════════════════════════════════

create table waiting_list (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  category_id         uuid references room_categories(id) on delete set null,
  occupant_id         uuid references occupants(id) on delete set null,
  contact_name        text,
  contact_phone       text,
  contact_email       text,
  preferred_check_in  date,
  preferred_duration  text,
  notes               text,
  priority            int not null default 0,
  status              text not null default 'waiting'
                      check (status in ('waiting', 'offered', 'converted', 'expired', 'cancelled')),
  offered_room_id     uuid references rooms(id) on delete set null,
  offered_at          timestamptz,
  notified_at         timestamptz,
  expires_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table waiting_list enable row level security;

create policy "waiting_list_tenant" on waiting_list
  for all using (
    exists (select 1 from tenant_members tm
            where tm.tenant_id = waiting_list.tenant_id
              and tm.user_id = auth.uid() and tm.is_active = true)
  );

create index on waiting_list (tenant_id, status);
create index on waiting_list (tenant_id, category_id, status);

create trigger waiting_list_updated_at
  before update on waiting_list
  for each row execute function set_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 026: Visitor passes (QR check-in)
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists visitor_logs (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  visitor_name   text not null,
  visitor_phone  text,
  host_name      text,
  room_id        uuid references rooms(id) on delete set null,
  purpose        text,
  checked_in_at  timestamptz not null default now(),
  checked_out_at timestamptz,
  notes          text,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists visitor_logs_tenant_id on visitor_logs (tenant_id);
create index if not exists visitor_logs_checked_in_at on visitor_logs (tenant_id, checked_in_at desc);

alter table visitor_logs enable row level security;

create policy "tenant members can manage visitor logs"
  on visitor_logs for all
  using (
    tenant_id in (
      select tenant_id from tenant_members where user_id = auth.uid()
    )
  );

alter table visitor_logs
  add column if not exists pass_token    text unique default encode(gen_random_bytes(12), 'hex'),
  add column if not exists expected_at   timestamptz,
  add column if not exists pass_used_at  timestamptz,
  add column if not exists pass_status   text not null default 'active'
    check (pass_status in ('active', 'used', 'expired', 'revoked'));

create index if not exists visitor_logs_pass_token on visitor_logs (pass_token);


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 027: Staff shift scheduling
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists staff_shifts (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  staff_id     uuid not null references staff_profiles(id) on delete cascade,
  shift_date   date not null,
  shift_start  time not null,
  shift_end    time not null,
  department   text,
  notes        text,
  status       text not null default 'scheduled'
               check (status in ('scheduled', 'completed', 'absent', 'swapped', 'cancelled')),
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table staff_shifts enable row level security;

drop policy if exists "staff_shifts_tenant" on staff_shifts;
create policy "staff_shifts_tenant" on staff_shifts
  for all using (
    exists (select 1 from tenant_members tm
            where tm.tenant_id = staff_shifts.tenant_id
              and tm.user_id = auth.uid() and tm.is_active = true)
  );

create index if not exists staff_shifts_tenant_id_shift_date_idx on staff_shifts (tenant_id, shift_date);
create index if not exists staff_shifts_staff_id_shift_date_idx on staff_shifts (staff_id, shift_date);

drop trigger if exists staff_shifts_updated_at on staff_shifts;
create trigger staff_shifts_updated_at
  before update on staff_shifts
  for each row execute function set_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 028: Occupant document storage
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists occupant_documents (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  occupant_id   uuid not null references occupants(id) on delete cascade,
  document_type text not null
                check (document_type in ('ghana_card', 'passport', 'voters_id', 'nhis',
                                         'tenancy_agreement', 'offer_letter', 'photo', 'other')),
  file_name     text not null,
  file_url      text not null,
  file_size     int,
  mime_type     text,
  notes         text,
  uploaded_by   uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

alter table occupant_documents enable row level security;

drop policy if exists "occupant_documents_tenant" on occupant_documents;
create policy "occupant_documents_tenant" on occupant_documents
  for all using (
    exists (select 1 from tenant_members tm
            where tm.tenant_id = occupant_documents.tenant_id
              and tm.user_id = auth.uid() and tm.is_active = true)
  );

create index if not exists occupant_documents_occupant_id_idx on occupant_documents (occupant_id);
create index if not exists occupant_documents_tenant_id_idx on occupant_documents (tenant_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 029: Room Inspection Checklists
-- ═══════════════════════════════════════════════════════════════════════════

create table room_inspections (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  room_id       uuid not null references rooms(id) on delete cascade,
  booking_id    uuid references bookings(id) on delete set null,
  type          text not null default 'check_in'
                  check (type in ('check_in','check_out','routine','maintenance')),
  status        text not null default 'draft'
                  check (status in ('draft','completed')),
  overall_condition text check (overall_condition in ('excellent','good','fair','poor')),
  items         jsonb not null default '[]',
  notes         text,
  inspected_by  uuid references auth.users(id) on delete set null,
  inspected_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger room_inspections_updated_at
  before update on room_inspections
  for each row execute function set_updated_at();

create index on room_inspections (tenant_id, room_id);
create index on room_inspections (tenant_id, created_at desc);

alter table room_inspections enable row level security;

create policy "tenant members can manage room inspections"
  on room_inspections for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 030: Meter Readings (utility tracking)
-- ═══════════════════════════════════════════════════════════════════════════

create table meter_readings (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  room_id         uuid not null references rooms(id) on delete cascade,
  utility_type    text not null check (utility_type in ('electricity','water','gas')),
  reading_date    date not null,
  reading_value   numeric(12,2) not null,
  previous_value  numeric(12,2),
  consumption     numeric(12,2) generated always as (
    case when previous_value is not null then reading_value - previous_value else null end
  ) stored,
  unit            text not null default 'kWh'
                    check (unit in ('kWh','m3','L')),
  unit_rate       integer not null default 0,
  charge_amount   integer generated always as (
    case when previous_value is not null
      then cast(((reading_value - previous_value) * unit_rate) as integer)
      else 0
    end
  ) stored,
  notes           text,
  recorded_by     uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index on meter_readings (tenant_id, room_id, reading_date desc);
create index on meter_readings (tenant_id, utility_type, reading_date desc);

alter table meter_readings enable row level security;

create policy "tenant members can manage meter readings"
  on meter_readings for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 031: Notice Board
-- ═══════════════════════════════════════════════════════════════════════════

create table notices (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  title        text not null,
  body         text not null,
  category     text not null default 'general'
               check (category in ('general','urgent','maintenance','payment','event')),
  is_pinned    boolean not null default false,
  published_at timestamptz not null default now(),
  expires_at   timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger notices_updated_at
  before update on notices
  for each row execute function set_updated_at();

create index on notices (tenant_id, published_at desc);
create index on notices (tenant_id, is_pinned, published_at desc);

alter table notices enable row level security;

create policy "tenant members can manage notices"
  on notices for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 032: Expense Tracking
-- ═══════════════════════════════════════════════════════════════════════════

create table expenses (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  category     text not null check (category in (
                 'utilities','repairs','salaries','supplies','maintenance',
                 'marketing','insurance','rent','equipment','other')),
  description  text not null,
  vendor       text,
  amount       integer not null check (amount > 0),
  expense_date date not null,
  receipt_url  text,
  payment_method text check (payment_method in ('cash','bank_transfer','momo','card','cheque')),
  reference    text,
  notes        text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger expenses_updated_at
  before update on expenses
  for each row execute function set_updated_at();

create index on expenses (tenant_id, expense_date desc);
create index on expenses (tenant_id, category);

alter table expenses enable row level security;

create policy "tenant members can manage expenses"
  on expenses for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 033: Post-checkout Feedback
-- ═══════════════════════════════════════════════════════════════════════════

create table occupant_feedback (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  booking_id          uuid not null references bookings(id) on delete cascade,
  occupant_id         uuid references occupants(id) on delete set null,
  overall_rating      smallint not null check (overall_rating between 1 and 5),
  cleanliness_rating  smallint check (cleanliness_rating between 1 and 5),
  staff_rating        smallint check (staff_rating between 1 and 5),
  value_rating        smallint check (value_rating between 1 and 5),
  would_recommend     boolean,
  comments            text,
  submitted_at        timestamptz not null default now(),
  created_at          timestamptz not null default now(),

  unique (booking_id)
);

create index on occupant_feedback (tenant_id, submitted_at desc);
create index on occupant_feedback (tenant_id, overall_rating);

alter table occupant_feedback enable row level security;

create policy "tenant members can read feedback"
  on occupant_feedback for select
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 034: Webhook Outbox
-- ═══════════════════════════════════════════════════════════════════════════

create table webhook_endpoints (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  url         text not null,
  secret      text not null default encode(gen_random_bytes(20), 'hex'),
  events      text[] not null default '{}',
  is_active   boolean not null default true,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger webhook_endpoints_updated_at
  before update on webhook_endpoints
  for each row execute function set_updated_at();

create index on webhook_endpoints (tenant_id, is_active);

create table webhook_events (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  endpoint_id      uuid not null references webhook_endpoints(id) on delete cascade,
  event_type       text not null,
  payload          jsonb not null default '{}',
  status           text not null default 'pending'
                   check (status in ('pending','delivered','failed')),
  attempts         smallint not null default 0,
  response_status  smallint,
  response_body    text,
  last_attempted_at timestamptz,
  delivered_at     timestamptz,
  created_at       timestamptz not null default now()
);

create index on webhook_events (tenant_id, created_at desc);
create index on webhook_events (endpoint_id, created_at desc);
create index on webhook_events (tenant_id, status);

alter table webhook_endpoints enable row level security;
alter table webhook_events     enable row level security;

create policy "tenant members can manage webhook endpoints"
  on webhook_endpoints for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );

create policy "tenant members can read webhook events"
  on webhook_events for select
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 035: Damage Deposits
-- ═══════════════════════════════════════════════════════════════════════════

create table damage_deposits (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  booking_id     uuid not null references bookings(id) on delete cascade,
  occupant_id    uuid not null references occupants(id) on delete cascade,
  amount         integer not null check (amount > 0),
  method         text not null check (method in ('cash','momo_mtn','momo_vodafone','momo_airteltigo','bank_transfer','card','cheque')),
  reference      text,
  collected_at   timestamptz not null default now(),
  status         text not null default 'held'
                 check (status in ('held','refunded','forfeited','partial_refund')),
  refund_amount  integer check (refund_amount >= 0),
  refund_reason  text,
  resolved_at    timestamptz,
  notes          text,
  collected_by   uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (booking_id)
);

create trigger damage_deposits_updated_at
  before update on damage_deposits
  for each row execute function set_updated_at();

create index on damage_deposits (tenant_id, status);
create index on damage_deposits (booking_id);
create index on damage_deposits (occupant_id);

alter table damage_deposits enable row level security;

create policy "tenant members can manage damage deposits"
  on damage_deposits for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 036: Occupant Blacklist
-- ═══════════════════════════════════════════════════════════════════════════

create table occupant_blacklist (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  occupant_id  uuid references occupants(id) on delete cascade,
  phone        text,
  reason       text not null,
  severity     text not null default 'warning'
               check (severity in ('warning','banned')),
  is_active    boolean not null default true,
  expires_at   timestamptz,
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


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 037: Customisable Notification Templates
-- ═══════════════════════════════════════════════════════════════════════════

create table notification_templates (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  event_type   text not null check (event_type in (
                 'booking_confirmed', 'booking_cancelled',
                 'payment_received', 'payment_reminder',
                 'checkin_reminder', 'checkout_reminder',
                 'lease_expiry_reminder', 'deposit_refund'
               )),
  channel      text not null check (channel in ('sms', 'email')),
  subject      text,
  body         text not null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (tenant_id, event_type, channel)
);

create trigger notification_templates_updated_at
  before update on notification_templates
  for each row execute function set_updated_at();

create index on notification_templates (tenant_id, event_type);

alter table notification_templates enable row level security;

create policy "tenant members can manage notification templates"
  on notification_templates for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 038: Key Management
-- ═══════════════════════════════════════════════════════════════════════════

create table room_keys (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  room_id        uuid not null references rooms(id) on delete cascade,
  key_label      text not null,
  key_type       text not null default 'physical'
                 check (key_type in ('physical','card','fob')),
  booking_id     uuid references bookings(id) on delete set null,
  occupant_id    uuid references occupants(id) on delete set null,
  issued_at      timestamptz,
  returned_at    timestamptz,
  status         text not null default 'available'
                 check (status in ('available','issued','lost','damaged','retired')),
  issued_by      uuid references auth.users(id) on delete set null,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger room_keys_updated_at
  before update on room_keys
  for each row execute function set_updated_at();

create index on room_keys (tenant_id, room_id);
create index on room_keys (tenant_id, status);
create index on room_keys (booking_id) where booking_id is not null;

alter table room_keys enable row level security;

create policy "tenant members can manage room keys"
  on room_keys for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 039: Occupant ID Verification Status
-- ═══════════════════════════════════════════════════════════════════════════

alter table occupants
  add column if not exists id_verified        boolean not null default false,
  add column if not exists id_verified_at     timestamptz,
  add column if not exists id_verified_by     uuid references auth.users(id) on delete set null,
  add column if not exists id_rejection_notes text;

create table id_verification_reviews (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  occupant_id  uuid not null references occupants(id) on delete cascade,
  document_id  uuid references occupant_documents(id) on delete set null,
  decision     text not null check (decision in ('approved', 'rejected', 'needs_resubmission')),
  notes        text,
  reviewed_by  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index on id_verification_reviews (tenant_id, created_at desc);
create index on id_verification_reviews (occupant_id);

alter table id_verification_reviews enable row level security;

create policy "tenant members can manage verification reviews"
  on id_verification_reviews for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 040: Recurring Report Schedules
-- ═══════════════════════════════════════════════════════════════════════════

create table report_schedules (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  name         text not null,
  report_type  text not null check (report_type in (
                 'bookings', 'occupants', 'payments', 'maintenance', 'expenses'
               )),
  frequency    text not null check (frequency in ('daily','weekly','monthly')),
  day_of_week  smallint check (day_of_week between 0 and 6),
  day_of_month smallint check (day_of_month between 1 and 28),
  recipients   text[] not null default '{}',
  is_active    boolean not null default true,
  last_sent_at timestamptz,
  next_run_at  timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger report_schedules_updated_at
  before update on report_schedules
  for each row execute function set_updated_at();

create index on report_schedules (tenant_id, is_active);
create index on report_schedules (next_run_at) where is_active = true;

alter table report_schedules enable row level security;

create policy "tenant members can manage report schedules"
  on report_schedules for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 041: Portal Auth
-- ═══════════════════════════════════════════════════════════════════════════

alter table occupants
  add column if not exists user_id uuid unique references auth.users(id) on delete set null,
  add column if not exists portal_enabled boolean not null default false,
  add column if not exists portal_invite_sent_at timestamptz;

create index if not exists occupants_user_id_idx on occupants (user_id) where user_id is not null;

create policy "occupant can read own bookings"
  on bookings for select
  using (
    occupant_id in (
      select id from occupants where user_id = auth.uid()
    )
  );

create policy "occupant can read own payments"
  on booking_payments for select
  using (
    booking_id in (
      select b.id from bookings b
      join occupants o on o.id = b.occupant_id
      where o.user_id = auth.uid()
    )
  );

create policy "occupant can create maintenance request"
  on maintenance_requests for insert
  with check (
    tenant_id in (
      select tm.tenant_id from tenant_members tm where tm.user_id = auth.uid()
      union
      select o.tenant_id from occupants o where o.user_id = auth.uid()
    )
  );

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'invoices') then
    execute $policy$
      create policy "occupant can read own invoices"
        on invoices for select
        using (
          booking_id in (
            select b.id from bookings b
            join occupants o on o.id = b.occupant_id
            where o.user_id = auth.uid()
          )
        )
    $policy$;
  end if;
end $$;

-- JWT hook updated (superseded by migrations 044 and 045 below)
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql security definer as $$
declare
  claims      jsonb;
  member_rec  record;
  occupant_rec record;
  is_admin    boolean := false;
begin
  claims := coalesce(event -> 'claims', '{}'::jsonb);

  begin
    select o.id, o.tenant_id, o.first_name, o.last_name,
           t.slug, t.name, t.logo_url, t.primary_color
    into   occupant_rec
    from   occupants o
    join   tenants t on t.id = o.tenant_id
    where  o.user_id = (event ->> 'user_id')::uuid
    limit  1;

    if found then
      claims := jsonb_set(claims, '{tenant_id}',    to_jsonb(occupant_rec.tenant_id::text));
      claims := jsonb_set(claims, '{tenant_slug}',  to_jsonb(occupant_rec.slug));
      claims := jsonb_set(claims, '{tenant_name}',  to_jsonb(occupant_rec.name));
      claims := jsonb_set(claims, '{portal_role}',  to_jsonb('occupant'::text));
      claims := jsonb_set(claims, '{occupant_id}',  to_jsonb(occupant_rec.id::text));
      if occupant_rec.logo_url is not null then
        claims := jsonb_set(claims, '{tenant_logo}',  to_jsonb(occupant_rec.logo_url));
      end if;
      if occupant_rec.primary_color is not null then
        claims := jsonb_set(claims, '{tenant_color}', to_jsonb(occupant_rec.primary_color));
      end if;
    end if;
  exception when others then null;
  end;

  begin
    select tm.tenant_id, tm.role, t.slug, t.name, t.logo_url, t.primary_color
    into   member_rec
    from   tenant_members tm
    join   tenants t on t.id = tm.tenant_id
    where  tm.user_id = (event ->> 'user_id')::uuid
      and  tm.is_active = true
    limit  1;

    if found then
      claims := jsonb_set(claims, '{tenant_id}',    to_jsonb(member_rec.tenant_id::text));
      claims := jsonb_set(claims, '{tenant_role}',  to_jsonb(member_rec.role::text));
      claims := jsonb_set(claims, '{tenant_slug}',  to_jsonb(member_rec.slug));
      claims := jsonb_set(claims, '{tenant_name}',  to_jsonb(member_rec.name));
      claims := jsonb_set(claims, '{portal_role}',  to_jsonb(
        case
          when member_rec.role in ('owner', 'manager', 'admin') then 'admin'
          else 'staff'
        end
      ));
      if member_rec.logo_url is not null then
        claims := jsonb_set(claims, '{tenant_logo}',  to_jsonb(member_rec.logo_url));
      end if;
      if member_rec.primary_color is not null then
        claims := jsonb_set(claims, '{tenant_color}', to_jsonb(member_rec.primary_color));
      end if;
    end if;
  exception when others then null;
  end;

  begin
    select exists(
      select 1 from platform_admins where user_id = (event ->> 'user_id')::uuid
    ) into is_admin;
  exception when others then null;
  end;

  if is_admin then
    claims := jsonb_set(claims, '{is_super_admin}', 'true'::jsonb);
  end if;

  return jsonb_set(event, '{claims}', claims);

exception when others then
  return event;
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 042: Storage buckets
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant-logos',
  'tenant-logos',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;

create policy "tenant members can upload logos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'tenant-logos'
  );

create policy "tenant members can update logos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'tenant-logos');

create policy "tenant members can delete logos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'tenant-logos');

create policy "logos are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'tenant-logos');


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 043: Occupant cascade
-- ═══════════════════════════════════════════════════════════════════════════

alter table bookings
  drop constraint bookings_occupant_id_fkey,
  add constraint bookings_occupant_id_fkey
    foreign key (occupant_id) references occupants(id) on delete cascade;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 044: Fix JWT hook order (occupants checked first)
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql security definer as $$
declare
  claims       jsonb;
  member_rec   record;
  occupant_rec record;
  is_admin     boolean := false;
begin
  claims := coalesce(event -> 'claims', '{}'::jsonb);

  begin
    select o.id, o.tenant_id, o.first_name, o.last_name,
           t.slug, t.name, t.logo_url, t.primary_color
    into   occupant_rec
    from   occupants o
    join   tenants t on t.id = o.tenant_id
    where  o.user_id = (event ->> 'user_id')::uuid
    limit  1;

    if found then
      claims := jsonb_set(claims, '{tenant_id}',   to_jsonb(occupant_rec.tenant_id::text));
      claims := jsonb_set(claims, '{tenant_slug}',  to_jsonb(occupant_rec.slug));
      claims := jsonb_set(claims, '{tenant_name}',  to_jsonb(occupant_rec.name));
      claims := jsonb_set(claims, '{portal_role}',  to_jsonb('occupant'::text));
      claims := jsonb_set(claims, '{occupant_id}',  to_jsonb(occupant_rec.id::text));
      if occupant_rec.logo_url is not null then
        claims := jsonb_set(claims, '{tenant_logo}',  to_jsonb(occupant_rec.logo_url));
      end if;
      if occupant_rec.primary_color is not null then
        claims := jsonb_set(claims, '{tenant_color}', to_jsonb(occupant_rec.primary_color));
      end if;

      return jsonb_set(event, '{claims}', claims);
    end if;
  exception when others then null;
  end;

  begin
    select tm.tenant_id, tm.role, t.slug, t.name, t.logo_url, t.primary_color
    into   member_rec
    from   tenant_members tm
    join   tenants t on t.id = tm.tenant_id
    where  tm.user_id = (event ->> 'user_id')::uuid
      and  tm.is_active = true
    limit  1;

    if found then
      claims := jsonb_set(claims, '{tenant_id}',   to_jsonb(member_rec.tenant_id::text));
      claims := jsonb_set(claims, '{tenant_role}',  to_jsonb(member_rec.role::text));
      claims := jsonb_set(claims, '{tenant_slug}',  to_jsonb(member_rec.slug));
      claims := jsonb_set(claims, '{tenant_name}',  to_jsonb(member_rec.name));
      claims := jsonb_set(claims, '{portal_role}',  to_jsonb(
        case
          when member_rec.role in ('owner', 'manager', 'admin') then 'admin'
          else 'staff'
        end
      ));
      if member_rec.logo_url is not null then
        claims := jsonb_set(claims, '{tenant_logo}',  to_jsonb(member_rec.logo_url));
      end if;
      if member_rec.primary_color is not null then
        claims := jsonb_set(claims, '{tenant_color}', to_jsonb(member_rec.primary_color));
      end if;
    end if;
  exception when others then null;
  end;

  begin
    select exists(
      select 1 from platform_admins where user_id = (event ->> 'user_id')::uuid
    ) into is_admin;
  exception when others then null;
  end;

  if is_admin then
    claims := jsonb_set(claims, '{is_super_admin}', 'true'::jsonb);
  end if;

  return jsonb_set(event, '{claims}', claims);

exception when others then
  return event;
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 045: JWT hook — add tenant_domain claim
-- (FINAL version of the JWT hook — this is the one that matters)
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql security definer as $$
declare
  claims       jsonb;
  member_rec   record;
  occupant_rec record;
  is_admin     boolean := false;
begin
  claims := coalesce(event -> 'claims', '{}'::jsonb);

  begin
    select o.id, o.tenant_id, o.first_name, o.last_name,
           t.slug, t.name, t.logo_url, t.primary_color, t.custom_domain
    into   occupant_rec
    from   occupants o
    join   tenants t on t.id = o.tenant_id
    where  o.user_id = (event ->> 'user_id')::uuid
    limit  1;

    if found then
      claims := jsonb_set(claims, '{tenant_id}',    to_jsonb(occupant_rec.tenant_id::text));
      claims := jsonb_set(claims, '{tenant_slug}',  to_jsonb(occupant_rec.slug));
      claims := jsonb_set(claims, '{tenant_name}',  to_jsonb(occupant_rec.name));
      claims := jsonb_set(claims, '{portal_role}',  to_jsonb('occupant'::text));
      claims := jsonb_set(claims, '{occupant_id}',  to_jsonb(occupant_rec.id::text));
      if occupant_rec.logo_url is not null then
        claims := jsonb_set(claims, '{tenant_logo}',   to_jsonb(occupant_rec.logo_url));
      end if;
      if occupant_rec.primary_color is not null then
        claims := jsonb_set(claims, '{tenant_color}',  to_jsonb(occupant_rec.primary_color));
      end if;
      if occupant_rec.custom_domain is not null then
        claims := jsonb_set(claims, '{tenant_domain}', to_jsonb(occupant_rec.custom_domain));
      end if;

      return jsonb_set(event, '{claims}', claims);
    end if;
  exception when others then null;
  end;

  begin
    select tm.tenant_id, tm.role, t.slug, t.name, t.logo_url, t.primary_color, t.custom_domain
    into   member_rec
    from   tenant_members tm
    join   tenants t on t.id = tm.tenant_id
    where  tm.user_id = (event ->> 'user_id')::uuid
      and  tm.is_active = true
    limit  1;

    if found then
      claims := jsonb_set(claims, '{tenant_id}',    to_jsonb(member_rec.tenant_id::text));
      claims := jsonb_set(claims, '{tenant_role}',  to_jsonb(member_rec.role::text));
      claims := jsonb_set(claims, '{tenant_slug}',  to_jsonb(member_rec.slug));
      claims := jsonb_set(claims, '{tenant_name}',  to_jsonb(member_rec.name));
      claims := jsonb_set(claims, '{portal_role}',  to_jsonb(
        case
          when member_rec.role in ('owner', 'manager', 'admin') then 'admin'
          else 'staff'
        end
      ));
      if member_rec.logo_url is not null then
        claims := jsonb_set(claims, '{tenant_logo}',   to_jsonb(member_rec.logo_url));
      end if;
      if member_rec.primary_color is not null then
        claims := jsonb_set(claims, '{tenant_color}',  to_jsonb(member_rec.primary_color));
      end if;
      if member_rec.custom_domain is not null then
        claims := jsonb_set(claims, '{tenant_domain}', to_jsonb(member_rec.custom_domain));
      end if;
    end if;
  exception when others then null;
  end;

  begin
    select exists(
      select 1 from platform_admins where user_id = (event ->> 'user_id')::uuid
    ) into is_admin;
  exception when others then null;
  end;

  if is_admin then
    claims := jsonb_set(claims, '{is_super_admin}', 'true'::jsonb);
  end if;

  return jsonb_set(event, '{claims}', claims);

exception when others then
  return event;
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 046: Tenant logos bucket (duplicate-safe)
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('tenant-logos', 'tenant-logos', true)
on conflict do nothing;

-- NOTE: These policies may already exist from migration 042.
-- If you get "policy already exists" errors, skip these 4 statements.
do $$
begin
  begin
    create policy "tenant logo upload"
      on storage.objects for insert
      with check (
        bucket_id = 'tenant-logos'
        and auth.role() = 'authenticated'
      );
  exception when duplicate_object then null;
  end;

  begin
    create policy "tenant logo update"
      on storage.objects for update
      using (
        bucket_id = 'tenant-logos'
        and auth.role() = 'authenticated'
      );
  exception when duplicate_object then null;
  end;

  begin
    create policy "tenant logo read"
      on storage.objects for select
      using (bucket_id = 'tenant-logos');
  exception when duplicate_object then null;
  end;

  begin
    create policy "tenant logo delete"
      on storage.objects for delete
      using (
        bucket_id = 'tenant-logos'
        and auth.role() = 'authenticated'
      );
  exception when duplicate_object then null;
  end;
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- DONE. All 40 migrations (007–046) applied.
-- ═══════════════════════════════════════════════════════════════════════════
