-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 030 — Meter Readings (utility tracking)
-- ═══════════════════════════════════════════════════════════════════════════

create table meter_readings (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  room_id         uuid not null references rooms(id) on delete cascade,
  utility_type    text not null check (utility_type in ('electricity','water','gas')),
  reading_date    date not null,
  reading_value   numeric(12,2) not null,        -- current meter reading
  previous_value  numeric(12,2),                 -- last reading (null = first reading)
  consumption     numeric(12,2) generated always as (
    case when previous_value is not null then reading_value - previous_value else null end
  ) stored,
  unit            text not null default 'kWh'    -- kWh / m³ / L
                    check (unit in ('kWh','m3','L')),
  unit_rate       integer not null default 0,    -- pesewas per unit
  charge_amount   integer generated always as (
    case when previous_value is not null
      then cast(((reading_value - previous_value) * unit_rate) as integer)
      else 0
    end
  ) stored,
  notes           text,
  recorded_by     uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index on meter_readings (tenant_id, room_id, reading_date desc);
create index on meter_readings (tenant_id, utility_type, reading_date desc);

alter table meter_readings enable row level security;

create policy "tenant members can manage meter readings"
  on meter_readings for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );
