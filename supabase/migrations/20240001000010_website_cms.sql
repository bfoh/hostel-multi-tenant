-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 011 — Website CMS content
-- Adds a website_content JSONB column to tenants for managing the
-- public booking page hero, about section, amenities, gallery and FAQ.
-- ═══════════════════════════════════════════════════════════════════════════

alter table tenants
  add column if not exists website_content jsonb not null default '{}'::jsonb;

comment on column tenants.website_content is
  'Structured CMS content for the hosted public booking page.
   Shape: { hero_heading, hero_subheading, about_text,
            amenities: string[], gallery_urls: string[],
            faqs: { q: string; a: string }[] }';
