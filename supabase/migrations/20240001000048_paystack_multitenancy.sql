-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 048 — Paystack Multi-Tenancy
--
-- Adds per-tenant Paystack Subaccount routing (Flow B: guest/occupant payments
-- land 100% in the hostel's bank) and platform-level subscription billing
-- state (Flow A: hostel owners pay the platform monthly via card).
--
-- Architecture:
--   • ONE Paystack merchant (gh-hostels.com).
--   • Each hostel = one Paystack Subaccount (percentage_charge = 0,
--     bearer = 'subaccount'). Routes 100% of guest payments to hostel bank.
--   • Platform subscriptions bill the tenant's billing contact against the
--     platform merchant — no subaccount on those charges.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Tenants — Subaccount columns (for Flow B routing) ───────────────────

alter table tenants add column if not exists paystack_subaccount_code  text;
alter table tenants add column if not exists paystack_bank_code        text;
alter table tenants add column if not exists paystack_bank_account_no  text;
alter table tenants add column if not exists paystack_settlement_bank  text;
alter table tenants add column if not exists paystack_account_name     text;
alter table tenants add column if not exists paystack_connected_at     timestamptz;

create unique index if not exists idx_tenants_paystack_subaccount
  on tenants (paystack_subaccount_code)
  where paystack_subaccount_code is not null;

comment on column tenants.paystack_subaccount_code is
  'Paystack subaccount code that routes guest payments to this hostel''s bank. Null until owner connects payouts.';

-- ── 2. Subscription status enum ────────────────────────────────────────────

do $$ begin
  create type subscription_status as enum (
    'trialing',
    'active',
    'past_due',
    'canceled',
    'incomplete'
  );
exception when duplicate_object then null; end $$;

-- ── 3. tenant_subscriptions (Flow A state) ─────────────────────────────────

create table if not exists tenant_subscriptions (
  id                         uuid primary key default gen_random_uuid(),
  tenant_id                  uuid not null references tenants(id) on delete cascade,

  paystack_customer_code     text not null,
  paystack_plan_code         text not null,
  paystack_subscription_code text unique,
  paystack_email_token       text,                            -- required to disable

  plan_name                  text not null,                   -- 'starter' | 'pro' | 'enterprise'
  amount                     bigint not null,                 -- pesewas
  currency                   text not null default 'GHS',

  status                     subscription_status not null default 'incomplete',
  current_period_start       timestamptz,
  current_period_end         timestamptz,
  canceled_at                timestamptz,
  last_payment_at            timestamptz,
  next_payment_at            timestamptz,

  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

-- Only one live subscription per tenant
create unique index if not exists idx_tenant_subscriptions_live
  on tenant_subscriptions (tenant_id)
  where status in ('trialing', 'active', 'past_due');

create index if not exists idx_tenant_subscriptions_tenant
  on tenant_subscriptions (tenant_id);

comment on table tenant_subscriptions is
  'Tracks each tenant''s active Paystack subscription for the platform SaaS fee.';

-- ── 4. paystack_events (idempotent webhook ledger) ─────────────────────────

create table if not exists paystack_events (
  id            uuid primary key default gen_random_uuid(),
  event_id      text unique,                       -- Paystack event id (when present)
  event_type    text not null,
  tenant_id     uuid references tenants(id) on delete set null,
  reference     text,                              -- transaction reference if any
  payload       jsonb not null,
  processed_at  timestamptz,
  error         text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_paystack_events_type      on paystack_events (event_type);
create index if not exists idx_paystack_events_tenant    on paystack_events (tenant_id);
create index if not exists idx_paystack_events_reference on paystack_events (reference) where reference is not null;
create index if not exists idx_paystack_events_unprocessed
  on paystack_events (created_at)
  where processed_at is null;

comment on table paystack_events is
  'Every Paystack webhook delivery. Dedup via event_id, replay via processed_at.';

-- ── 5. updated_at trigger for tenant_subscriptions ─────────────────────────

create or replace function set_updated_at_tenant_subscriptions()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_tenant_subscriptions_updated_at on tenant_subscriptions;
create trigger trg_tenant_subscriptions_updated_at
  before update on tenant_subscriptions
  for each row execute function set_updated_at_tenant_subscriptions();

-- ── 6. RLS ─────────────────────────────────────────────────────────────────

alter table tenant_subscriptions enable row level security;
alter table paystack_events      enable row level security;

-- tenant_subscriptions: tenant members read their own row
drop policy if exists tenant_subscriptions_read on tenant_subscriptions;
create policy tenant_subscriptions_read
  on tenant_subscriptions for select
  using (tenant_id = public.tenant_id());

-- No tenant write access — subscription rows are mutated server-side by the
-- webhook/billing routes using the service role key (bypasses RLS).

-- paystack_events: locked down — only service role reads. No tenant policies.
-- (Service role bypasses RLS by design, so no policy needed for it.)
