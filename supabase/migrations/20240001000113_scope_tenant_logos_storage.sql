-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 113 — Scope tenant-logos storage policies by tenant
-- Migrations 042 and 046 both created insert/update/delete policies on the
-- `tenant-logos` bucket that only checked `auth.role() = 'authenticated'`,
-- with no verification that the object path belongs to a tenant the caller
-- is actually a member of. Any authenticated user (staff or occupant, of
-- ANY tenant) could overwrite or delete any other tenant's logo, since the
-- app-side route (`/api/settings/logo`) uploads via the user's own session
-- client and relies entirely on this bucket's RLS for authorization.
--
-- Path convention (see app/api/settings/logo/route.ts): {tenant_id}/logo.{ext}
-- Fix: require the first path segment to match a tenant the caller belongs
-- to as an active tenant_member (any role — branding edits, aside from bank
-- deposit fields, are open to all active staff roles at the app layer).
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop every previously-created policy on this bucket by exact name (both
-- the 042 and 046 copies) so we start from a clean, single set of rules.
drop policy if exists "tenant members can upload logos" on storage.objects;
drop policy if exists "tenant members can update logos" on storage.objects;
drop policy if exists "tenant members can delete logos" on storage.objects;
drop policy if exists "logos are publicly readable"      on storage.objects;
drop policy if exists "tenant logo upload"                on storage.objects;
drop policy if exists "tenant logo update"                on storage.objects;
drop policy if exists "tenant logo read"                  on storage.objects;
drop policy if exists "tenant logo delete"                on storage.objects;

create policy "tenant_logos_insert_own_tenant"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'tenant-logos'
    and exists (
      select 1 from tenant_members tm
      where tm.user_id = auth.uid()
        and tm.is_active = true
        and tm.tenant_id::text = (storage.foldername(name))[1]
    )
  );

create policy "tenant_logos_update_own_tenant"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'tenant-logos'
    and exists (
      select 1 from tenant_members tm
      where tm.user_id = auth.uid()
        and tm.is_active = true
        and tm.tenant_id::text = (storage.foldername(name))[1]
    )
  );

create policy "tenant_logos_delete_own_tenant"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'tenant-logos'
    and exists (
      select 1 from tenant_members tm
      where tm.user_id = auth.uid()
        and tm.is_active = true
        and tm.tenant_id::text = (storage.foldername(name))[1]
    )
  );

-- Bucket is public — logos are shown on public booking pages, invoices, etc.
create policy "tenant_logos_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'tenant-logos');
