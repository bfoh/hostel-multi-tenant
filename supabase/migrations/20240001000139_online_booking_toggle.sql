-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 139 — Online booking pause toggle
--
-- Lets an owner pause online bookings without delisting from the
-- marketplace (listed_publicly) — e.g. Abrempong had made enough offline
-- bookings and needed time to allocate rooms before opening the online
-- widget back up. When false, the public booking page and API show zero
-- available rooms regardless of actual room_occupancy_v availability.
-- ═══════════════════════════════════════════════════════════════════════════

alter table tenants
  add column if not exists online_booking_enabled boolean not null default true;
