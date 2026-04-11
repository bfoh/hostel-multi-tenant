-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 014 — Asset Register
-- Tracks hostel property (furniture, appliances, equipment) with QR codes.
-- ═══════════════════════════════════════════════════════════════════════════

create type asset_status as enum ('active', 'maintenance', 'disposed', 'lost');
create type asset_condition as enum ('excellent', 'good', 'fair', 'poor');

create table assets (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,

  -- Identity
  name            text not null,
  category        text not null default 'general',  -- furniture, appliance, electronics, fixture, vehicle, other
  description     text,
  brand           text,
  model           text,
  serial_number   text,

  -- QR code — a short unique code printed/stuck on the asset
  qr_code         text not null unique,

  -- Location
  room_id         uuid references rooms(id) on delete set null,
  location_note   text,  -- e.g. "Common room, near window" when not in a specific room

  -- Financial
  purchase_date   date,
  purchase_price  integer,    -- pesewas
  supplier        text,
  warranty_expiry date,

  -- Status
  status          asset_status    not null default 'active',
  condition       asset_condition not null default 'good',

  -- Metadata
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index on assets (tenant_id, status);
create index on assets (tenant_id, category);
create index on assets (tenant_id, room_id);
create unique index on assets (tenant_id, qr_code);

alter table assets enable row level security;

create policy "tenant_read_assets"
  on assets for select
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid()));

create policy "tenant_write_assets"
  on assets for all
  using (
    tenant_id in (
      select tenant_id from tenant_members
      where user_id = auth.uid() and role in ('owner', 'manager', 'accountant')
    )
  );

-- Auto-update updated_at
create or replace function touch_assets_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger assets_updated_at
  before update on assets
  for each row execute procedure touch_assets_updated_at();
