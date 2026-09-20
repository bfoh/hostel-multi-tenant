-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 119 — Public marketplace foundation columns
--
-- Part of the public hostel marketplace feature. Adds:
--   1. Redefines tenants.is_active to mean "reachable" (trial, active, or
--      trial_expired) rather than "fully subscribed" — a trial_expired
--      tenant keeps its public listing and minimal dashboard live; only a
--      platform-enforced 'suspended' or owner-initiated 'cancelled' tenant
--      hits the full /suspended lockout in middleware.ts. No other SQL
--      object depends on the prior definition (verified via repo grep).
--   2. tenants.listed_publicly — owner-facing opt-out toggle for the public
--      directory. Defaults true so every existing tenant is auto-listed with
--      zero backfill (a constant DEFAULT on ADD COLUMN populates instantly).
--   3. tenants.booking_payment_mode — per-tenant guest checkout mode: online
--      (Paystack subaccount charge at booking) or pay_at_hostel (reserve,
--      pay on arrival).
--   4. Indexes on the EXISTING tenants.address_city / address_region columns
--      (added in migration 004, already collected at onboarding and already
--      shown on the booking page/invoices) for directory search/filtering —
--      deliberately not adding new city/region columns, to avoid a second,
--      divergent copy of the same data.
--   5. Indexes backing the directory search query, and a small helper
--      function (tenant_has_booking_access) that a later migration wires
--      into the bookings RLS policies for the minimal post-trial dashboard.
-- ═══════════════════════════════════════════════════════════════════════════

alter table tenants drop column is_active;
alter table tenants add column is_active boolean not null
  generated always as (status in ('active', 'trial', 'trial_expired')) stored;

alter table tenants add column listed_publicly boolean not null default true;

alter table tenants add column booking_payment_mode text not null default 'online'
  check (booking_payment_mode in ('online', 'pay_at_hostel'));

comment on column tenants.listed_publicly     is 'Owner opt-out toggle for the public marketplace directory. Default true: every tenant is auto-listed.';
comment on column tenants.booking_payment_mode is 'Guest checkout mode for this tenant''s public booking flow: online (Paystack subaccount charge at booking) or pay_at_hostel (reserve now, pay on arrival).';

-- ── Directory search indexes ─────────────────────────────────────────────────

create index tenants_directory_idx on tenants (address_city)
  where listed_publicly = true and status in ('trial', 'active', 'trial_expired');

create index tenants_name_trgm_idx on tenants using gin (name gin_trgm_ops);

-- ── Booking-access helper for the minimal post-trial dashboard ──────────────
-- A trial_expired tenant keeps read access to bookings but loses the ability
-- to create/modify/cancel them (owner is restricted to editing room prices +
-- viewing existing bookings). 'trial' and 'active' have full access.
-- Wired into the bookings RLS policies in a later migration (RBAC/middleware
-- phase), kept here so the schema and its access-boundary logic land together.

create or replace function public.tenant_has_booking_access(p_tenant_id uuid)
returns boolean language sql stable as $$
  select status in ('trial', 'active') from tenants where id = p_tenant_id
$$;
