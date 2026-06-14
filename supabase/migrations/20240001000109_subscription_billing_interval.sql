-- Track the billing interval of a platform subscription so the app can render
-- the cycle (monthly / quarterly / 6-month / yearly) and discount correctly.
-- Existing rows are monthly.

alter table tenant_subscriptions
  add column if not exists billing_interval text not null default 'monthly';

alter table tenant_subscriptions
  drop constraint if exists tenant_subscriptions_billing_interval_chk;

alter table tenant_subscriptions
  add constraint tenant_subscriptions_billing_interval_chk
  check (billing_interval in ('monthly', 'quarterly', 'biannual', 'annual'));
