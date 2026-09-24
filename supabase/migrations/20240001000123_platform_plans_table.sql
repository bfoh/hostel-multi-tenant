-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 123 — Platform plans table (Paystack plan-code persistence)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Until now, Paystack plan codes (one per tier × billing interval) lived only
-- in env vars (PAYSTACK_PLAN_<TIER>_<INTERVAL>), hand-pasted by an admin after
-- running the bootstrap endpoint and requiring a redeploy to take effect. This
-- table gives the bootstrap endpoint a durable place to record the codes it
-- creates on Paystack, so they survive without a manual paste-and-redeploy
-- step. lib/platform-plans.ts's read path (env-var resolution) is UNCHANGED
-- by this migration — this is additive persistence only; wiring the read
-- side to prefer this table over env vars is a separate, follow-up change.
--
-- business_type is included (defaulting to 'hostel', the only vertical with
-- live plans today) so a future hotel plan catalog can share this table
-- instead of needing its own.

create table platform_plans (
  id                uuid primary key default gen_random_uuid(),
  business_type     text not null default 'hostel' check (business_type in ('hostel', 'hotel')),
  tier              text not null,
  billing_interval  text not null check (billing_interval in ('monthly', 'quarterly', 'biannual', 'annual')),
  plan_code         text not null,
  amount_pesewas    bigint not null,
  paystack_interval text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (business_type, tier, billing_interval)
);

comment on table platform_plans is
  'Canonical (business_type × tier × billing_interval) -> Paystack plan_code mapping, written by the admin bootstrap-plans endpoint. Superset of what env vars store today.';

-- Only service role can read/write this table — same lockdown pattern as
-- platform_admins (migration 022): RLS enabled with an explicit deny-all
-- policy, since the service-role client bypasses RLS entirely.
alter table platform_plans enable row level security;
create policy "platform_plans_service_only" on platform_plans
  using (false);

create trigger platform_plans_set_updated_at
  before update on platform_plans
  for each row execute function set_updated_at();
