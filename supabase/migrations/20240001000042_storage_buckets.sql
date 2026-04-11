-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 042 — Storage buckets
-- Creates the tenant-logos public bucket and RLS policies.
-- ═══════════════════════════════════════════════════════════════════════════

-- Create the tenant-logos bucket (public, 5 MB limit, images only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant-logos',
  'tenant-logos',
  true,
  5242880,  -- 5 MB
  array['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;

-- Allow authenticated users to upload/replace their own tenant logo
create policy "tenant members can upload logos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'tenant-logos'
  );

create policy "tenant members can update logos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'tenant-logos');

create policy "tenant members can delete logos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'tenant-logos');

-- Public read (bucket is public, but explicit policy is good practice)
create policy "logos are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'tenant-logos');
