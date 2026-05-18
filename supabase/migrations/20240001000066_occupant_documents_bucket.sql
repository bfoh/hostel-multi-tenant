-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 066 — Create occupant-documents storage bucket
-- ═══════════════════════════════════════════════════════════════════════════
-- The /api/public/[slug]/self-checkin route and the staff document upload at
-- /api/occupants/[id]/documents both write to a bucket named
-- `occupant-documents`. Migration 028 documented the bucket name in a
-- comment but never created it, so production self check-ins failed with
-- "Storage upload failed: Bucket not found". Create it idempotently and
-- attach scoped read/delete policies.
--
-- Service role (used by the API routes via createAdminClient) bypasses RLS,
-- so inserts succeed without an explicit INSERT policy.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'occupant-documents',
  'occupant-documents',
  false,
  5242880,  -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Tenant members can read documents whose object path is prefixed with
-- their tenant_id. Path format: {tenant_id}/{occupant_id}/{filename}
drop policy if exists "occupant_documents_select_tenant" on storage.objects;
create policy "occupant_documents_select_tenant"
  on storage.objects for select
  using (
    bucket_id = 'occupant-documents'
    and exists (
      select 1 from tenant_members tm
      where tm.user_id = auth.uid()
        and tm.is_active = true
        and tm.tenant_id::text = split_part(name, '/', 1)
    )
  );

-- Same scope for deletes (admins can purge a document from the UI).
drop policy if exists "occupant_documents_delete_tenant" on storage.objects;
create policy "occupant_documents_delete_tenant"
  on storage.objects for delete
  using (
    bucket_id = 'occupant-documents'
    and exists (
      select 1 from tenant_members tm
      where tm.user_id = auth.uid()
        and tm.is_active = true
        and tm.tenant_id::text = split_part(name, '/', 1)
    )
  );
