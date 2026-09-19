-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 116 — Fix the occupants self-select RLS policy (finding #4)
--
-- Migration 002's "occupants_can_read_own_record" policy:
--
--   using (
--     tenant_id = public.tenant_id()
--     and public.tenant_role() = 'occupant'
--     and auth.uid() in (
--       select user_id from tenant_members where tenant_id = public.tenant_id()
--     )
--   )
--
-- has two problems:
--
--   1. It's dead code today. `public.tenant_role()` reads the `tenant_role`
--      JWT claim, which the custom_access_token_hook (migration 041) only
--      ever sets for tenant_members sessions (staff) — occupant-portal
--      sessions get `portal_role = 'occupant'` instead, and `tenant_role`
--      is never set for them. So this condition can never be true for an
--      actual occupant.
--
--   2. Even ignoring #1, it has no per-row check at all. It verifies the
--      caller is *some* member of the tenant (via the tenant_members
--      subquery — itself odd, since occupants aren't tenant_members), but
--      never compares `occupants.user_id` to `auth.uid()`. If a future
--      change ever did start setting `tenant_role = 'occupant'`, this
--      policy would let any resident read every other resident's row in
--      the tenant — full name, national ID, emergency contact, academic
--      info.
--
-- In practice this hasn't been exploitable: the app reads occupant-portal
-- data server-side via the service-role admin client
-- (lib/auth/occupant-session.ts, allow-listed in
-- scripts/audit-tenant-scoping.mjs), never through this policy. But a dead,
-- broken-if-it-ever-fired policy is a loaded gun left lying around for the
-- next person who assumes RLS already protects this table client-side.
--
-- Fix: replace it with a policy that actually works for real occupant
-- sessions and is correctly scoped per-row. `tenant_id` and `portal_role`
-- ARE both set correctly for occupants by the hook (see migration 041 —
-- the occupant branch sets both claims), so this makes the policy
-- functional, not just less wrong.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.portal_role() returns text language sql stable security definer as $$
  select current_setting('request.jwt.claims', true)::jsonb ->> 'portal_role'
$$;

drop policy if exists "occupants_can_read_own_record" on occupants;

create policy "occupants_can_read_own_record"
  on occupants for select
  using (
    tenant_id = public.tenant_id()
    and public.portal_role() = 'occupant'
    and user_id = auth.uid()
  );
