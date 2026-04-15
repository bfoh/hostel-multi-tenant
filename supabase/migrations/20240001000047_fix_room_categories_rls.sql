-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 047 — Fix room_categories RLS policy
-- The original "FOR ALL" policy was missing a WITH CHECK clause,
-- which caused INSERT to be blocked by RLS.
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS owners_managers_can_manage_categories ON room_categories;

CREATE POLICY owners_managers_can_manage_categories
  ON room_categories FOR ALL
  USING (
    tenant_id = public.tenant_id()
    AND public.tenant_role() IN ('owner', 'manager')
  )
  WITH CHECK (
    tenant_id = public.tenant_id()
    AND public.tenant_role() IN ('owner', 'manager')
  );
