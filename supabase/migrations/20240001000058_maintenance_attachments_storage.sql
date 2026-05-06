-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 058 — Maintenance Attachments Bucket
-- Private bucket with signed URL access only. Path scheme:
--   <tenant_id>/<request_id>/<message_id>/<filename>
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'maintenance-attachments',
  'maintenance-attachments',
  false,
  5 * 1024 * 1024,
  array[
    'image/jpeg','image/png','image/webp','image/heic','image/heif','image/heic-sequence',
    'application/pdf'
  ]
)
on conflict (id) do update set
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Block all client direct read; service role bypasses RLS so server can issue
-- signed URLs from route handlers.
drop policy if exists "no direct client read of maintenance attachments" on storage.objects;
create policy "no direct client read of maintenance attachments"
  on storage.objects for select to authenticated
  using (bucket_id <> 'maintenance-attachments');
