-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 018 — Anomaly Detection Rules & Alerts
-- ═══════════════════════════════════════════════════════════════════════════

create type anomaly_severity as enum ('info', 'warning', 'critical');

-- ── Anomaly rules (per-tenant configurable) ───────────────────────────────────
create table anomaly_rules (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,

  name        text not null,                        -- human label
  metric      text not null,                        -- e.g. 'revenue_drop', 'occupancy_low', 'payment_spike'
  threshold   numeric not null,                     -- e.g. 30 (for 30% drop)
  window_days smallint not null default 7,          -- comparison window
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

-- ── Anomaly alert log (append-only) ──────────────────────────────────────────
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

-- ── Seed default rules for all existing tenants ───────────────────────────────
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
