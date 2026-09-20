-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 120 — Restrict booking mutations for trial_expired tenants
--
-- Part of the minimal post-trial dashboard: a trial_expired owner keeps
-- read access to bookings (see the "staff_can_read_bookings" policy,
-- untouched) but loses the ability to create/modify/cancel them — pricing
-- edits and viewing bookings are the two things that stay live.
--
-- The primary enforcement is the middleware.ts allow-list (returns 402 for
-- non-GET /api/bookings* requests). This is defense-in-depth at the RLS
-- layer for the same boundary, using the tenant_has_booking_access() helper
-- added in migration 119.
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "reception_can_manage_bookings" on bookings;
create policy "reception_can_manage_bookings"
  on bookings for insert
  with check (
    tenant_id = public.tenant_id()
    and public.tenant_role() in ('owner', 'manager', 'receptionist')
    and public.tenant_has_booking_access(tenant_id)
  );

drop policy if exists "reception_can_update_bookings" on bookings;
create policy "reception_can_update_bookings"
  on bookings for update
  using (
    tenant_id = public.tenant_id()
    and public.tenant_role() in ('owner', 'manager', 'receptionist')
    and public.tenant_has_booking_access(tenant_id)
  );

drop policy if exists "managers_can_delete_bookings" on bookings;
create policy "managers_can_delete_bookings"
  on bookings for delete
  using (
    tenant_id = public.tenant_id()
    and public.tenant_role() in ('owner', 'manager')
    and public.tenant_has_booking_access(tenant_id)
  );
