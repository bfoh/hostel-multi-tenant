-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 121 — Room category photos bucket (public, image-only)
--
-- Room categories already have an image_urls text[] column (migration 001)
-- and every public booking surface (/api/public/[slug]/rooms, the /book
-- flow, the new /hostels/[slug] marketplace profile) already reads and
-- displays it — but there was never an upload path for owners to actually
-- populate it. This bucket backs the new POST/DELETE
-- /api/room-categories/[id]/photos route.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'room-photos',
  'room-photos',
  true,
  4 * 1024 * 1024,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public             = true,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
