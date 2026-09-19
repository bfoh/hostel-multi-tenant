-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 117 — Lock down EXECUTE on tenant-scoped SECURITY DEFINER RPCs
--
-- Found while hardening the tenant-scoping audit (finding #5 follow-up):
-- five SECURITY DEFINER functions take a caller-supplied ID (p_tenant_id or
-- p_room_id) and use it to scope an internal read/write, but never verify
-- the calling session actually has any relationship to that ID. Supabase
-- exposes every function in the `public` schema as a PostgREST RPC endpoint
-- (`/rest/v1/rpc/<name>`) to whichever roles hold EXECUTE on it — so the
-- grants on these functions are the *entire* access-control boundary, not
-- app-code convention.
--
--   release_stale_pending_payment_bookings(uuid, int)
--   release_stale_self_checkin_reservations(uuid, int)
--
--   Both explicitly `grant ... to service_role, authenticated`. Any
--   authenticated user of ANY tenant could call either directly with
--   another tenant's ID and p_max_age_minutes = 0 to instantly cancel
--   every one of that tenant's in-flight bookings (and, for the
--   self-checkin one, flip the affected rooms back to 'available') —
--   a cross-tenant denial-of-service against the core booking flow,
--   available to anyone with a free/trial account on the platform.
--
--   compute_daily_report(uuid, date)
--
--   Has no explicit GRANT/REVOKE at all in any migration. Postgres grants
--   EXECUTE on every new function to PUBLIC by default (unlike tables,
--   which default to no access) — so this one is callable by `anon`, i.e.
--   with no authentication whatsoever, for any tenant.
--
--   room_active_bed_count(uuid, date), room_free_bed_count(uuid)
--
--   Also `grant ... to service_role, authenticated`, but confirmed unused:
--   room_occupancy_v (the only other SQL object that could plausibly call
--   them) inlines the same COUNT(*) logic directly rather than calling
--   either function, and no application code calls them either. Pure
--   unnecessary attack surface — a smaller leak (a bed-occupancy count for
--   a guessed room_id) than the two above, but the same class of mistake.
--
-- Confirmed (grep across apps/web) that every call site for all five
-- functions uses createAdminClient() — the service-role client — so
-- narrowing these grants to service_role only changes no application
-- behavior.
-- ═══════════════════════════════════════════════════════════════════════════

revoke all on function release_stale_pending_payment_bookings(uuid, int)   from public, authenticated, anon;
revoke all on function release_stale_self_checkin_reservations(uuid, int)  from public, authenticated, anon;
revoke all on function compute_daily_report(uuid, date)                   from public, authenticated, anon;
revoke all on function room_active_bed_count(uuid, date)                  from public, authenticated, anon;
revoke all on function room_free_bed_count(uuid)                          from public, authenticated, anon;

grant execute on function release_stale_pending_payment_bookings(uuid, int)  to service_role;
grant execute on function release_stale_self_checkin_reservations(uuid, int) to service_role;
grant execute on function compute_daily_report(uuid, date)                   to service_role;
grant execute on function room_active_bed_count(uuid, date)                  to service_role;
grant execute on function room_free_bed_count(uuid)                          to service_role;
