-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 029 — Room Inspection Checklists
-- ═══════════════════════════════════════════════════════════════════════════

create table room_inspections (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  room_id       uuid not null references rooms(id) on delete cascade,
  booking_id    uuid references bookings(id) on delete set null,
  type          text not null default 'check_in'
                  check (type in ('check_in','check_out','routine','maintenance')),
  status        text not null default 'draft'
                  check (status in ('draft','completed')),
  overall_condition text check (overall_condition in ('excellent','good','fair','poor')),
  -- JSONB array of { item: text, condition: text, notes: text }
  items         jsonb not null default '[]',
  notes         text,
  inspected_by  uuid references auth.users(id) on delete set null,
  inspected_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger room_inspections_updated_at
  before update on room_inspections
  for each row execute function set_updated_at();

create index on room_inspections (tenant_id, room_id);
create index on room_inspections (tenant_id, created_at desc);

alter table room_inspections enable row level security;

create policy "tenant members can manage room inspections"
  on room_inspections for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );
