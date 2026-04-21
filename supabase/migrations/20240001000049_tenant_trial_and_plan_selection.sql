-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 049 — Tenant Trial Period & Plan Selection
--
-- Adds:
--   1. selected_plan column on tenants (carries signup intent → billing page)
--   2. Default trial_ends_at for any trial tenant that doesn't have one yet
--   3. A trigger so newly-created trial tenants automatically get a 30-day
--      trial_ends_at if one isn't explicitly provided.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Add selected_plan column ────────────────────────────────────────────
-- Stores the plan the owner picked on the landing page (starter/growth/pro)
-- or 'trial' if they chose the free trial. The billing page reads this to
-- auto-initiate a Paystack subscription after onboarding.

alter table tenants
  add column if not exists selected_plan text;

comment on column tenants.selected_plan is
  'Plan chosen at signup (starter/growth/pro/trial). Consumed by billing page for auto-subscribe.';

-- ── 2. Backfill trial_ends_at for existing trial tenants ───────────────────
-- Any tenant in 'trial' status without a trial_ends_at gets 30 days from now.

update tenants
set    trial_ends_at = now() + interval '30 days'
where  status = 'trial'
  and  trial_ends_at is null;

-- ── 3. Auto-set trial_ends_at on new trial tenants ────────────────────────
-- When a tenant row is inserted or updated to 'trial' status and trial_ends_at
-- is still null, auto-assign 30 days from now.

create or replace function public.set_trial_ends_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'trial' and new.trial_ends_at is null then
    new.trial_ends_at := now() + interval '30 days';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tenants_set_trial_ends_at on tenants;
create trigger trg_tenants_set_trial_ends_at
  before insert or update of status on tenants
  for each row execute function public.set_trial_ends_at();

-- ── 4. Promote tenant to 'active' when a subscription activates ───────────
-- When a tenant_subscriptions row transitions to 'active', mark the tenant as
-- active so the trial banner disappears and plan limits lift.

create or replace function public.activate_tenant_on_subscription()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'active' and (old.status is distinct from 'active') then
    update tenants
    set    status = 'active',
           plan   = new.plan_name::subscription_plan
    where  id = new.tenant_id
      and  status in ('trial', 'suspended');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_activate_tenant_on_subscription on tenant_subscriptions;
create trigger trg_activate_tenant_on_subscription
  after update of status on tenant_subscriptions
  for each row execute function public.activate_tenant_on_subscription();

-- Also handle first insert as 'active' (edge case: manual admin insert)
drop trigger if exists trg_activate_tenant_on_subscription_insert on tenant_subscriptions;
create trigger trg_activate_tenant_on_subscription_insert
  after insert on tenant_subscriptions
  for each row
  when (new.status = 'active')
  execute function public.activate_tenant_on_subscription();

-- ── 5. Fix is_active to include trial tenants ─────────────────────────────
-- The original computed column was: (status = 'active')
-- This meant trial tenants had is_active = FALSE, causing the middleware to
-- rewrite all their requests to /maintenance. Trial tenants must be active.

alter table tenants drop column is_active;
alter table tenants add column is_active boolean not null generated always as (status in ('active', 'trial')) stored;
