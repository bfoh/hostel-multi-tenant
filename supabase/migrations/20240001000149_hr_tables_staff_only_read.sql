-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 149 — Keep residents out of the HR tables
--
-- Migration 005's read policies on staff_profiles, attendance_records and
-- leave_requests only check `tenant_id = public.tenant_id()`. The
-- custom_access_token_hook sets the tenant_id claim for residents too
-- (occupant sessions get tenant_id + portal_role = 'occupant', never
-- tenant_role), so any resident could read every staff member's salary,
-- Ghana Card, TIN, SSNIT and bank/MoMo details, plus attendance and leave
-- history, straight from the REST API with their own session and the public
-- anon key.
--
-- Every staff session carries tenant_role, so requiring it keeps today's
-- behaviour for all staff while refusing resident sessions. No resident
-- feature reads these tables with the resident's own session (messaging
-- looks staff names up with the service role).
--
-- Not addressed here: every staff role can still read every colleague's
-- full HR record. Narrowing that needs a decision on which roles see which
-- columns, and app changes for the screens that list colleagues.
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "hr_select_staff_profiles" on staff_profiles;
create policy "hr_select_staff_profiles"
  on staff_profiles for select
  using (tenant_id = public.tenant_id() and public.tenant_role() is not null and public.tenant_role() <> 'occupant');

drop policy if exists "hr_select_attendance" on attendance_records;
create policy "hr_select_attendance"
  on attendance_records for select
  using (tenant_id = public.tenant_id() and public.tenant_role() is not null and public.tenant_role() <> 'occupant');

drop policy if exists "hr_select_leave" on leave_requests;
create policy "hr_select_leave"
  on leave_requests for select
  using (tenant_id = public.tenant_id() and public.tenant_role() is not null and public.tenant_role() <> 'occupant');
