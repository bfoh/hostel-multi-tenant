-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 015 — Preventive Maintenance Schedules
-- ═══════════════════════════════════════════════════════════════════════════

-- Recurrence frequency options
create type pm_frequency as enum (
  'daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'biannual', 'annual'
);

create type pm_status as enum ('active', 'paused', 'archived');

-- ── Preventive maintenance schedules ─────────────────────────────────────────
-- Each schedule defines a recurring task (e.g. "Monthly boiler check")
-- When due, it spawns a maintenance_request work order automatically.

create table pm_schedules (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,

  -- What & where
  title           text not null check (char_length(title) between 1 and 150),
  description     text,
  category        text not null default 'other'
                    check (category in ('plumbing','electrical','hvac','structural','furniture','appliance','cleaning','pest_control','security','other')),
  room_id         uuid references rooms(id) on delete set null,
  location_note   text,

  -- Recurrence
  frequency       pm_frequency not null,
  interval_value  smallint not null default 1 check (interval_value >= 1),  -- e.g. every 2 weeks

  -- Scheduling
  start_date      date not null,
  next_due_date   date not null,
  last_run_date   date,

  -- Defaults pushed to spawned work orders
  default_priority    text not null default 'medium'
                        check (default_priority in ('low','medium','high','urgent')),
  default_contractor_id uuid references contractors(id) on delete set null,
  estimated_cost_ghs  numeric(10,2),

  -- Lifecycle
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

-- ── RLS ──────────────────────────────────────────────────────────────────────
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

-- ── Link spawned work orders back to their schedule ───────────────────────────
-- Add optional foreign key on maintenance_requests so we can show history.
alter table maintenance_requests
  add column if not exists pm_schedule_id uuid references pm_schedules(id) on delete set null;

create index if not exists idx_maintenance_requests_pm_schedule_id on maintenance_requests (pm_schedule_id);
