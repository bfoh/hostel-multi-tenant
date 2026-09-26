-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 127 — Property photo bucket (public, image-only)
--
-- Backs tenants.hero_image_url (migration 126). No RLS policies, mirroring
-- 20240001000121_room_photos_storage.sql — the write route
-- (api/onboarding/hero-image) uses the service-role admin client and treats
-- its own explicit tenant-membership check as the real authorization gate,
-- and a public bucket serves reads without needing a SELECT policy.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant-photos',
  'tenant-photos',
  true,
  5 * 1024 * 1024,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public             = true,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
