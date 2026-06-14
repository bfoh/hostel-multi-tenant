-- Remember the billing interval the owner picked on the landing page, so the
-- billing toggle can be pre-selected when they reach Settings → Billing after
-- onboarding (mirrors tenants.selected_plan).

alter table tenants
  add column if not exists selected_interval text;

alter table tenants
  drop constraint if exists tenants_selected_interval_chk;

alter table tenants
  add constraint tenants_selected_interval_chk
  check (selected_interval is null or selected_interval in ('monthly', 'quarterly', 'biannual', 'annual'));
