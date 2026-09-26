-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 128 — Booking charges (hotel-only folio line-items)
--
-- Additional charges (minibar, laundry, room service, etc.) added to a
-- booking's folio — ported from AMP Lodge's booking_charges concept, gated
-- to hotel tenants at the application layer (getServerBusinessType()).
--
-- Deliberately NOT folded into bookings.final_amount, which is a Postgres
-- `generated always as` column relied on by occupant-invoices.ts, the
-- invoice PDF route, staff-revenue.ts, and dashboards — altering that
-- expression risks every existing consumer. Instead, mirrors AMP Lodge's
-- own working pattern: a booking's true bill is
-- final_amount + sum(booking_charges.amount), computed at read time.
-- ═══════════════════════════════════════════════════════════════════════════

create table booking_charges (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  booking_id     uuid not null references bookings(id) on delete cascade,
  description    text not null,
  category       text not null check (category in
                   ('food_beverage', 'room_service', 'minibar', 'laundry', 'phone_internet', 'parking', 'other')),
  quantity       integer not null default 1 check (quantity > 0),
  unit_price     integer not null check (unit_price >= 0),   -- pesewas
  amount         integer generated always as (quantity * unit_price) stored,
  payment_method payment_method,                             -- null = "pay later" (unpaid, added to folio)
  paid           boolean not null default true,
  notes          text,
  created_by     uuid not null references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger booking_charges_updated_at
  before update on booking_charges
  for each row execute function set_updated_at();

create index on booking_charges (tenant_id, booking_id);

alter table booking_charges enable row level security;

create policy "tenant members can manage booking charges"
  on booking_charges for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );
