-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 006 — Operations Tables
-- Maintenance, security (visitors, incidents, lost & found), communications.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Enums ────────────────────────────────────────────────────────────────────

create type maintenance_priority as enum ('low', 'medium', 'high', 'urgent');
create type maintenance_status   as enum ('open', 'in_progress', 'on_hold', 'completed', 'cancelled');
create type maintenance_category as enum (
  'plumbing', 'electrical', 'hvac', 'structural', 'cleaning',
  'furniture', 'appliance', 'pest_control', 'security', 'other'
);
create type incident_severity    as enum ('low', 'medium', 'high', 'critical');
create type incident_status      as enum ('open', 'investigating', 'closed');
create type visitor_purpose      as enum ('visit_occupant', 'delivery', 'maintenance', 'official', 'other');
create type lost_found_type      as enum ('lost', 'found');
create type lost_found_status    as enum ('unclaimed', 'claimed', 'disposed');
create type sms_blast_status     as enum ('pending', 'scheduled', 'sent', 'failed');

-- ── Contractor directory ──────────────────────────────────────────────────────

create table contractors (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  name         text not null,
  company      text,
  phone        text not null,
  email        text,
  specialty    maintenance_category not null default 'other',
  rating       smallint check (rating between 1 and 5),
  notes        text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create index on contractors (tenant_id, is_active);

-- ── Maintenance work orders ───────────────────────────────────────────────────

create table maintenance_requests (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  ref_number     text not null,                  -- e.g. MNT-2024-0001
  title          text not null,
  description    text,
  category       maintenance_category not null default 'other',
  priority       maintenance_priority not null default 'medium',
  status         maintenance_status   not null default 'open',

  -- Location
  room_id        uuid references rooms(id),

  -- Assignment
  contractor_id  uuid references contractors(id),
  scheduled_date date,
  assigned_at    timestamptz,

  -- Resolution
  resolved_at    timestamptz,
  actual_cost    integer,
  estimated_cost integer,
  notes          text,

  -- Reported by
  reported_by    uuid references auth.users(id),

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger maintenance_updated_at
  before update on maintenance_requests
  for each row execute function set_updated_at();

create index on maintenance_requests (tenant_id, status);
create index on maintenance_requests (tenant_id, priority);
create index on maintenance_requests (room_id);

-- Auto-generate ref number
create or replace function generate_maintenance_ref()
returns trigger language plpgsql as $$
declare v_count integer;
begin
  select count(*) + 1 into v_count
  from maintenance_requests
  where tenant_id = new.tenant_id;
  new.ref_number := 'MNT-' || extract(year from now())::text || '-' || lpad(v_count::text, 4, '0');
  return new;
end;
$$;

create trigger set_maintenance_ref
  before insert on maintenance_requests
  for each row execute function generate_maintenance_ref();

-- ── Visitor log ───────────────────────────────────────────────────────────────

create table visitor_log (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  visitor_name    text not null,
  visitor_phone   text,
  visitor_id      text,                          -- national ID or other ID
  purpose         visitor_purpose not null default 'visit_occupant',
  host_name       text,                          -- occupant being visited
  room_number     text,                          -- room they're visiting
  vehicle_plate   text,
  check_in_at     timestamptz not null default now(),
  check_out_at    timestamptz,
  notes           text,
  recorded_by     uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

create index on visitor_log (tenant_id, check_in_at desc);

-- ── Incident reports ──────────────────────────────────────────────────────────

create table incident_reports (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenants(id) on delete cascade,
  ref_number         text not null,
  title              text not null,
  description        text not null,
  severity           incident_severity not null default 'low',
  status             incident_status   not null default 'open',
  occurred_at        timestamptz not null default now(),
  location           text,
  involved_parties   text,
  action_taken       text,
  police_ref         text,
  reported_by        uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger incident_updated_at
  before update on incident_reports
  for each row execute function set_updated_at();

create index on incident_reports (tenant_id, occurred_at desc);
create index on incident_reports (tenant_id, severity);

create or replace function generate_incident_ref()
returns trigger language plpgsql as $$
declare v_count integer;
begin
  select count(*) + 1 into v_count
  from incident_reports where tenant_id = new.tenant_id;
  new.ref_number := 'INC-' || extract(year from now())::text || '-' || lpad(v_count::text, 4, '0');
  return new;
end;
$$;

create trigger set_incident_ref
  before insert on incident_reports
  for each row execute function generate_incident_ref();

-- ── Lost & found ──────────────────────────────────────────────────────────────

create table lost_found_items (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  type            lost_found_type   not null default 'found',
  item_name       text not null,
  description     text,
  location_found  text,
  found_date      date not null default current_date,
  owner_name      text,
  owner_phone     text,
  room_number     text,
  status          lost_found_status not null default 'unclaimed',
  recorded_by     uuid references auth.users(id),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger lost_found_updated_at
  before update on lost_found_items
  for each row execute function set_updated_at();

create index on lost_found_items (tenant_id, status);
create index on lost_found_items (tenant_id, created_at desc);

-- ── SMS blasts (communication hub) ───────────────────────────────────────────

create table sms_blasts (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  message         text not null,
  recipient_type  text not null default 'manual_list',
  recipient_count integer not null default 0,
  sent_count      integer not null default 0,
  failed_count    integer not null default 0,
  status          sms_blast_status not null default 'pending',
  created_by      uuid references auth.users(id),
  scheduled_at    timestamptz,
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index on sms_blasts (tenant_id, created_at desc);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table contractors          enable row level security;
alter table maintenance_requests enable row level security;
alter table visitor_log          enable row level security;
alter table incident_reports     enable row level security;
alter table lost_found_items     enable row level security;
alter table sms_blasts           enable row level security;

create policy "ops_contractors_select" on contractors for select using (tenant_id = public.tenant_id());
create policy "ops_contractors_manage" on contractors for all
  using (tenant_id = public.tenant_id() and public.tenant_role() in ('owner', 'manager'));

create policy "ops_maintenance_select" on maintenance_requests for select using (tenant_id = public.tenant_id());
create policy "ops_maintenance_manage" on maintenance_requests for all
  using (tenant_id = public.tenant_id() and public.tenant_role() in ('owner', 'manager', 'receptionist'));

create policy "ops_visitor_select" on visitor_log for select using (tenant_id = public.tenant_id());
create policy "ops_visitor_manage" on visitor_log for all
  using (tenant_id = public.tenant_id() and public.tenant_role() in ('owner', 'manager', 'receptionist', 'security'));

create policy "ops_incident_select" on incident_reports for select using (tenant_id = public.tenant_id());
create policy "ops_incident_manage" on incident_reports for all
  using (tenant_id = public.tenant_id() and public.tenant_role() in ('owner', 'manager', 'security'));

create policy "ops_lostfound_select" on lost_found_items for select using (tenant_id = public.tenant_id());
create policy "ops_lostfound_manage" on lost_found_items for all
  using (tenant_id = public.tenant_id() and public.tenant_role() in ('owner', 'manager', 'receptionist', 'security'));

create policy "ops_sms_select" on sms_blasts for select
  using (tenant_id = public.tenant_id() and public.tenant_role() in ('owner', 'manager'));
create policy "ops_sms_manage" on sms_blasts for all
  using (tenant_id = public.tenant_id() and public.tenant_role() in ('owner', 'manager'));
