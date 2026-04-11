-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 027 — Staff shift scheduling
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists staff_shifts (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  staff_id     uuid not null references staff_profiles(id) on delete cascade,
  shift_date   date not null,
  shift_start  time not null,
  shift_end    time not null,
  department   text,   -- 'front_desk', 'housekeeping', 'security', 'maintenance', 'kitchen'
  notes        text,
  status       text not null default 'scheduled'
               check (status in ('scheduled', 'completed', 'absent', 'swapped', 'cancelled')),
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table staff_shifts enable row level security;

drop policy if exists "staff_shifts_tenant" on staff_shifts;
create policy "staff_shifts_tenant" on staff_shifts
  for all using (
    exists (select 1 from tenant_members tm
            where tm.tenant_id = staff_shifts.tenant_id
              and tm.user_id = auth.uid() and tm.is_active = true)
  );

create index if not exists staff_shifts_tenant_id_shift_date_idx on staff_shifts (tenant_id, shift_date);
create index if not exists staff_shifts_staff_id_shift_date_idx on staff_shifts (staff_id, shift_date);

drop trigger if exists staff_shifts_updated_at on staff_shifts;
create trigger staff_shifts_updated_at
  before update on staff_shifts
  for each row execute function set_updated_at();
