-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 150 — Service role only for room_occupancy_v
--
-- The view runs with its owner's rights (no security_invoker), so it skips
-- RLS on rooms and bookings, and Supabase's default grants let the anon and
-- authenticated roles select from it. Anyone with the public anon key could
-- read every property's room numbers, capacity and bed occupancy.
--
-- Every reader in the app (public booking and self check-in pages and APIs,
-- lib/data/rooms.ts) uses the service-role client, so nothing else needs it.
-- ═══════════════════════════════════════════════════════════════════════════

revoke all on room_occupancy_v from public, anon, authenticated;
grant select on room_occupancy_v to service_role;
