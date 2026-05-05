-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 056 — Bank Drafts Storage Bucket
-- Private bucket for student-uploaded bank draft files. RLS restricts:
--   - INSERT: occupant uploading to a path under their own tenant + booking
--   - SELECT: same occupant + tenant owner/accountant
--   - No UPDATE, no DELETE policies (cancellation goes through the API
--     route using the service role).
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bank-drafts',
  'bank-drafts',
  false,
  5242880,  -- 5 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/heic']
)
on conflict (id) do update set
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public             = excluded.public;

-- Path convention: {tenant_id}/{booking_id}/{payment_id}.{ext}
-- (storage.foldername(name) returns the path segments as text[])

create policy "occupant uploads own bank draft"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'bank-drafts'
    and exists (
      select 1
        from bookings b
        join occupants o on o.id = b.occupant_id
       where o.user_id  = auth.uid()
         and b.tenant_id::text = (storage.foldername(name))[1]
         and b.id::text        = (storage.foldername(name))[2]
    )
  );

create policy "occupant reads own bank draft"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'bank-drafts'
    and exists (
      select 1
        from bookings b
        join occupants o on o.id = b.occupant_id
       where o.user_id  = auth.uid()
         and b.tenant_id::text = (storage.foldername(name))[1]
         and b.id::text        = (storage.foldername(name))[2]
    )
  );

create policy "owner or accountant reads tenant bank drafts"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'bank-drafts'
    and (storage.foldername(name))[1] in (
      select tm.tenant_id::text
        from tenant_members tm
       where tm.user_id = auth.uid()
         and tm.is_active
         and tm.role in ('owner', 'accountant')
    )
  );
