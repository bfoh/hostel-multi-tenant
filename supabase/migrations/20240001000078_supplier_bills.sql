-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 078 — Supplier bills (Accounts Payable workspace)
--
-- Distinct from `expenses` which records cash already paid. A supplier_bill
-- captures a payable obligation with its own lifecycle:
--   draft     → captured but not yet approved
--   approved  → approved for payment, balance reflected in AP
--   partial   → partial payment recorded
--   paid      → fully settled
--   cancelled → voided
--
-- Journals are posted on approval (DR Expense / CR Accounts Payable) and on
-- payment (DR Accounts Payable / CR Cash) via the existing journal_entries
-- + journal_lines schema; bookkeeping happens in the API layer, not via
-- triggers (consistent with the expense_journal_posting migration pattern).
-- ═══════════════════════════════════════════════════════════════════════════

create type supplier_bill_status as enum (
  'draft', 'approved', 'partial', 'paid', 'cancelled'
);

create table supplier_bills (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id) on delete cascade,

  vendor_name           text not null,
  vendor_contact        text,                                -- phone/email free-text
  bill_number           text,                                -- supplier's invoice no.
  bill_date             date not null default current_date,
  due_date              date not null,
  category              text not null check (category in (
                          'utilities','repairs','salaries','supplies','maintenance',
                          'marketing','insurance','rent','equipment','other')),
  description           text not null,
  amount                integer not null check (amount > 0),           -- pesewas
  paid_amount           integer not null default 0 check (paid_amount >= 0),
  status                supplier_bill_status not null default 'draft',
  expense_account_id    uuid references chart_of_accounts(id),
  notes                 text,

  created_by            uuid references auth.users(id) on delete set null,
  approved_by           uuid references auth.users(id) on delete set null,
  approved_at           timestamptz,
  approval_entry_id     uuid references journal_entries(id) on delete set null,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index on supplier_bills (tenant_id, status, due_date);
create index on supplier_bills (tenant_id, vendor_name);

create trigger supplier_bills_updated_at
  before update on supplier_bills
  for each row execute function set_updated_at();

-- Payment record per bill — supports partial payments.
create table supplier_bill_payments (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  bill_id         uuid not null references supplier_bills(id) on delete cascade,
  amount          integer not null check (amount > 0),                  -- pesewas
  paid_at         date not null default current_date,
  payment_method  text not null check (payment_method in ('cash','bank_transfer','momo','card','cheque')),
  reference       text,
  notes           text,
  journal_entry_id uuid references journal_entries(id) on delete set null,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index on supplier_bill_payments (tenant_id, bill_id);
create index on supplier_bill_payments (tenant_id, paid_at desc);

-- RLS — all tenant members may read; writes guarded at the API layer (admin client).
alter table supplier_bills         enable row level security;
alter table supplier_bill_payments enable row level security;

create policy "tenant members read bills"
  on supplier_bills for select
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid()));

create policy "tenant members read bill payments"
  on supplier_bill_payments for select
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid()));
