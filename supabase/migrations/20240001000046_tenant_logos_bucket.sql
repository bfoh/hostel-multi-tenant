-- Create storage bucket for tenant logos
insert into storage.buckets (id, name, public)
values ('tenant-logos', 'tenant-logos', true)
on conflict do nothing;

-- Authenticated users can upload to their own tenant folder
create policy "tenant logo upload"
  on storage.objects for insert
  with check (
    bucket_id = 'tenant-logos'
    and auth.role() = 'authenticated'
  );

-- Allow UPDATE (upsert/replace)
create policy "tenant logo update"
  on storage.objects for update
  using (
    bucket_id = 'tenant-logos'
    and auth.role() = 'authenticated'
  );

-- Public read — logos are shown on public booking pages
create policy "tenant logo read"
  on storage.objects for select
  using (bucket_id = 'tenant-logos');

-- Authenticated users can delete their own logos
create policy "tenant logo delete"
  on storage.objects for delete
  using (
    bucket_id = 'tenant-logos'
    and auth.role() = 'authenticated'
  );
