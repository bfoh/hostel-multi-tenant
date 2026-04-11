-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 032 — Expense Tracking
-- ═══════════════════════════════════════════════════════════════════════════

create table expenses (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  category     text not null check (category in (
                 'utilities','repairs','salaries','supplies','maintenance',
                 'marketing','insurance','rent','equipment','other')),
  description  text not null,
  vendor       text,
  amount       integer not null check (amount > 0),   -- pesewas
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
