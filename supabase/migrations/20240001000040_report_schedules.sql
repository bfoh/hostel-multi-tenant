-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 040 — Recurring Report Schedules
-- ═══════════════════════════════════════════════════════════════════════════

create table report_schedules (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  name         text not null,
  report_type  text not null check (report_type in (
                 'bookings', 'occupants', 'payments', 'maintenance', 'expenses'
               )),
  frequency    text not null check (frequency in ('daily','weekly','monthly')),
  day_of_week  smallint check (day_of_week between 0 and 6),  -- 0=Sun, weekly only
  day_of_month smallint check (day_of_month between 1 and 28), -- monthly only
  recipients   text[] not null default '{}',   -- email addresses
  is_active    boolean not null default true,
  last_sent_at timestamptz,
  next_run_at  timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger report_schedules_updated_at
  before update on report_schedules
  for each row execute function set_updated_at();

create index on report_schedules (tenant_id, is_active);
create index on report_schedules (next_run_at) where is_active = true;

alter table report_schedules enable row level security;

create policy "tenant members can manage report schedules"
  on report_schedules for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );
