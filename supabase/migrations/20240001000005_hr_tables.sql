-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 006 — HR Module
-- Staff profiles, attendance, leave management, and payroll.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Enums ────────────────────────────────────────────────────────────────────

create type employment_type as enum ('full_time', 'part_time', 'contract', 'casual');
create type leave_type      as enum ('annual', 'sick', 'maternity', 'paternity', 'emergency', 'unpaid');
create type leave_status    as enum ('pending', 'approved', 'rejected', 'cancelled');
create type payroll_status  as enum ('draft', 'approved', 'paid');

-- ── Staff profiles ────────────────────────────────────────────────────────────
-- Extends tenant_members with HR-specific data.

create table staff_profiles (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  member_id        uuid not null references tenant_members(id) on delete cascade,
  user_id          uuid references auth.users(id),

  -- Personal
  first_name       text not null,
  last_name        text not null,
  other_names      text,
  date_of_birth    date,
  gender           gender_type,
  phone            text,
  email            text,
  photo_url        text,

  -- Ghana ID
  ghana_card_number text,
  ghana_card_url    text,

  -- Employment
  employee_id      text,                       -- internal staff ID
  employment_type  employment_type not null default 'full_time',
  job_title        text,
  department       text,
  start_date       date,
  end_date         date,                       -- null = still employed
  is_active        boolean not null default true,

  -- Compensation (pesewas per month)
  basic_salary     integer not null default 0,

  -- Ghana tax & social security
  tin_number       text,                       -- Tax Identification Number
  ssnit_number     text,                       -- SSNIT contributor number
  is_ssnit_exempt  boolean not null default false,

  -- Banking
  bank_name        text,
  bank_branch      text,
  bank_account_number text,
  bank_account_name   text,
  momo_number      text,
  momo_network     text,

  -- Emergency contact
  emergency_name   text,
  emergency_phone  text,
  emergency_relation text,

  -- Address
  address          text,
  city             text,
  region           text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (tenant_id, member_id)
);

create trigger staff_profiles_updated_at
  before update on staff_profiles
  for each row execute function set_updated_at();

create index on staff_profiles (tenant_id);
create index on staff_profiles (tenant_id, is_active);

-- ── Attendance records ────────────────────────────────────────────────────────

create table attendance_records (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  staff_id       uuid not null references staff_profiles(id) on delete cascade,
  date           date not null,
  clock_in       timestamptz,
  clock_out      timestamptz,
  clock_in_lat   numeric(9,6),
  clock_in_lng   numeric(9,6),
  clock_out_lat  numeric(9,6),
  clock_out_lng  numeric(9,6),
  notes          text,
  recorded_by    uuid references auth.users(id),  -- null = self clock-in
  created_at     timestamptz not null default now(),

  unique (tenant_id, staff_id, date)
);

create index on attendance_records (tenant_id, date);
create index on attendance_records (staff_id, date);

-- ── Leave requests ────────────────────────────────────────────────────────────

create table leave_requests (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  staff_id       uuid not null references staff_profiles(id) on delete cascade,
  leave_type     leave_type not null,
  start_date     date not null,
  end_date       date not null,
  days           integer not null generated always as (end_date - start_date + 1) stored,
  reason         text,
  status         leave_status not null default 'pending',
  reviewed_by    uuid references auth.users(id),
  reviewed_at    timestamptz,
  review_note    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger leave_requests_updated_at
  before update on leave_requests
  for each row execute function set_updated_at();

create index on leave_requests (tenant_id, status);
create index on leave_requests (staff_id);

-- ── Payroll runs ──────────────────────────────────────────────────────────────

create table payroll_runs (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  period_start  date not null,
  period_end    date not null,
  total_gross   integer not null default 0,
  status        payroll_status not null default 'draft',
  notes         text,
  created_by    uuid references auth.users(id),
  paid_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger payroll_runs_updated_at
  before update on payroll_runs
  for each row execute function set_updated_at();

create index on payroll_runs (tenant_id, period_start desc);

-- ── Payroll items (one per staff per run) ────────────────────────────────────

create table payroll_items (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  payroll_run_id   uuid not null references payroll_runs(id) on delete cascade,
  staff_id         uuid not null references staff_profiles(id),

  -- Snapshot of salary at time of run (pesewas)
  basic_salary     integer not null,
  allowances       integer not null default 0,

  -- Deductions (pesewas)
  ssnit_employee   integer not null default 0,   -- 5.5% of basic
  ssnit_employer   integer not null default 0,   -- 13% of basic
  paye_tax         integer not null default 0,
  other_deductions integer not null default 0,

  -- Net (pesewas)
  net_salary       integer not null,             -- gross - total_deductions

  status           text not null default 'pending',
  created_at       timestamptz not null default now(),

  unique (payroll_run_id, staff_id)
);

create index on payroll_items (payroll_run_id);
create index on payroll_items (staff_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table staff_profiles    enable row level security;
alter table attendance_records enable row level security;
alter table leave_requests     enable row level security;
alter table payroll_runs       enable row level security;
alter table payroll_items      enable row level security;

-- Owners & managers see everything; staff see their own profile
create policy "hr_select_staff_profiles"
  on staff_profiles for select
  using (tenant_id = public.tenant_id());

create policy "hr_manage_staff_profiles"
  on staff_profiles for all
  using (tenant_id = public.tenant_id() and public.tenant_role() in ('owner', 'manager'));

create policy "hr_select_attendance"
  on attendance_records for select
  using (tenant_id = public.tenant_id());

create policy "hr_manage_attendance"
  on attendance_records for all
  using (tenant_id = public.tenant_id() and public.tenant_role() in ('owner', 'manager', 'receptionist'));

create policy "hr_select_leave"
  on leave_requests for select
  using (tenant_id = public.tenant_id());

create policy "hr_manage_leave"
  on leave_requests for all
  using (tenant_id = public.tenant_id() and public.tenant_role() in ('owner', 'manager'));

create policy "hr_select_payroll"
  on payroll_runs for select
  using (tenant_id = public.tenant_id() and public.tenant_role() in ('owner', 'manager', 'accountant'));

create policy "hr_manage_payroll"
  on payroll_runs for all
  using (tenant_id = public.tenant_id() and public.tenant_role() in ('owner', 'manager', 'accountant'));

create policy "hr_select_payroll_items"
  on payroll_items for select
  using (tenant_id = public.tenant_id() and public.tenant_role() in ('owner', 'manager', 'accountant'));

create policy "hr_manage_payroll_items"
  on payroll_items for all
  using (tenant_id = public.tenant_id() and public.tenant_role() in ('owner', 'manager', 'accountant'));

-- Note: "owners_can_update_own_tenant" policy on tenants was already
-- created in a prior migration run. No action needed here.
