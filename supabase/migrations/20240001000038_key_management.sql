-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 038 — Key Management
-- ═══════════════════════════════════════════════════════════════════════════

create table room_keys (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  room_id        uuid not null references rooms(id) on delete cascade,
  key_label      text not null,          -- e.g. "Key A", "Duplicate", "Master"
  key_type       text not null default 'physical'
                 check (key_type in ('physical','card','fob')),
  booking_id     uuid references bookings(id) on delete set null,
  occupant_id    uuid references occupants(id) on delete set null,
  issued_at      timestamptz,
  returned_at    timestamptz,
  status         text not null default 'available'
                 check (status in ('available','issued','lost','damaged','retired')),
  issued_by      uuid references auth.users(id) on delete set null,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger room_keys_updated_at
  before update on room_keys
  for each row execute function set_updated_at();

create index on room_keys (tenant_id, room_id);
create index on room_keys (tenant_id, status);
create index on room_keys (booking_id) where booking_id is not null;

alter table room_keys enable row level security;

create policy "tenant members can manage room keys"
  on room_keys for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );
