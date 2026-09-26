-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 126 — tenants.hero_image_url (property photo)
--
-- Listings are auto-published to the public marketplace once onboarding
-- completes, but there was no tenant-level property photo — the directory
-- card's hero image (lib/directory.ts) was purely derived from the first
-- room-category photo it could find. This adds a real, owner-uploaded
-- property photo (e.g. building exterior), distinct from a specific room
-- type's own photos, that the marketplace prefers when set.
--
-- Additive nullable column, same precedent as tenants.business_type in
-- 20240001000122_tenants_business_type.sql — no backfill needed.
-- ═══════════════════════════════════════════════════════════════════════════

alter table tenants add column hero_image_url text;

comment on column tenants.hero_image_url is
  'Owner-uploaded property photo (e.g. building exterior) shown as the marketplace listing''s primary image. Falls back to a room-category photo when unset (see lib/directory.ts).';
