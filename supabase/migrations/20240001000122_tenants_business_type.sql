-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 122 — tenants.business_type (hostel vs hotel vertical)
--
-- First step of the hotel vertical: adds a business_type dimension to
-- tenants so the same platform/backend can host both hostel and hotel
-- listings, distinguished by which marketplace subdomain/site a tenant is
-- reachable at (e.g. hostels.aya.com vs hotels.aya.com).
--
-- Text + check, not a new enum type — a future third vertical (e.g.
-- apartments, already stubbed as a disabled tab in the marketplace's
-- HeroSearch component) is then a one-line constraint change, not the
-- multi-migration ALTER TYPE ... ADD VALUE dance a real enum would require
-- (see 20240001000118_tenant_status_trial_expired.sql for that pattern,
-- needed only for tenants.plan/tenants.status which ARE true enums already).
--
-- Additive column with a constant DEFAULT populates instantly with zero
-- backfill, same precedent as tenants.listed_publicly / booking_payment_mode
-- in 20240001000119_public_marketplace_columns.sql — every existing tenant
-- is a hostel today, so 'hostel' is the correct default for all of them.
-- ═══════════════════════════════════════════════════════════════════════════

alter table tenants
  add column business_type text not null default 'hostel'
  check (business_type in ('hostel', 'hotel'));

comment on column tenants.business_type is
  'Which vertical this tenant belongs to: hostel or hotel. Drives which marketplace subdomain/site the tenant is listed on and reachable at (e.g. hostels.aya.com vs hotels.aya.com).';

-- Widen the existing public-directory index (migration 119) to lead with
-- business_type, so a vertical-filtered directory query (e.g. hotels.aya.com's
-- listing search) doesn't have to scan across the other vertical's rows.
drop index if exists tenants_directory_idx;
create index tenants_directory_idx on tenants (business_type, address_city)
  where listed_publicly = true and status in ('trial', 'active', 'trial_expired');
