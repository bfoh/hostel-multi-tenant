-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 129 — Booking groups (hotel-only group bookings)
--
-- Links multiple `bookings` rows (one per room) together as a single group,
-- ported from AMP Lodge's group-booking concept but deliberately simpler:
-- each room keeps its own independent discount/booking_charges/
-- booking_payments completely unchanged — this table is purely a linking
-- record plus billing-contact info for a combined invoice view. No
-- group-level discount/charges/payment table, unlike AMP Lodge's model.
-- Gated to hotel tenants at the application layer (getServerBusinessType()).
-- ═══════════════════════════════════════════════════════════════════════════

create table booking_groups (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id) on delete cascade,
  group_ref             text not null,   -- e.g. GRP-2026-A1B2
  billing_contact_name  text,
  billing_contact_email text,
  billing_contact_phone text,
  status                text not null default 'active' check (status in ('active', 'cancelled')),
  created_by            uuid references auth.users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique (tenant_id, group_ref)
);

create trigger booking_groups_updated_at
  before update on booking_groups
  for each row execute function set_updated_at();

alter table bookings add column group_id uuid references booking_groups(id);
create index on bookings (group_id) where group_id is not null;

alter table booking_groups enable row level security;

create policy "tenant members can manage booking groups"
  on booking_groups for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );
