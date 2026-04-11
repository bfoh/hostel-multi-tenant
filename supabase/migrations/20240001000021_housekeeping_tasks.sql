-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 022 — Housekeeping Tasks
-- Auto-created on checkout; assigned to housekeeping staff.
-- ═══════════════════════════════════════════════════════════════════════════

create type hk_task_status   as enum ('pending', 'in_progress', 'done', 'skipped');
create type hk_task_priority as enum ('urgent', 'high', 'normal', 'low');

create table housekeeping_tasks (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  room_id      uuid not null references rooms(id) on delete cascade,
  assigned_to  uuid references staff_profiles(id) on delete set null,
  status       hk_task_status   not null default 'pending',
  priority     hk_task_priority not null default 'normal',
  notes        text,
  due_by       date,                -- usually = next check-in date
  source       text default 'manual', -- 'checkout' | 'manual' | 'schedule'
  booking_id   uuid references bookings(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index on housekeeping_tasks (tenant_id, status);
create index on housekeeping_tasks (room_id);
create index on housekeeping_tasks (assigned_to);
create index on housekeeping_tasks (due_by) where status != 'done';

alter table housekeeping_tasks enable row level security;

create policy "hk_tasks_tenant"
  on housekeeping_tasks for all
  using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = housekeeping_tasks.tenant_id
        and tm.user_id   = auth.uid()
        and tm.is_active = true
    )
  );

create trigger housekeeping_tasks_updated_at
  before update on housekeeping_tasks
  for each row execute function set_updated_at();
