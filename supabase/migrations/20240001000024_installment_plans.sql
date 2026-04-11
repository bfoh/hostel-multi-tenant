-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 024 — Installment payment plans
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
  unique (booking_id)  -- one plan per booking
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
