-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 076 — Per-tenant enquiry webhook secret
--
-- Lets external form services (Readdy.ai, FormBold, Zapier, custom scripts)
-- POST enquiries straight into the platform without depending on browser
-- Origin headers. Each tenant gets a unique secret that the webhook route
-- (/api/webhooks/enquiry/[slug]) checks before inserting a waiting_list row.
-- ═══════════════════════════════════════════════════════════════════════════

alter table tenants
  add column if not exists enquiry_webhook_secret text not null default gen_random_uuid()::text;

-- Backfill is implicit (every existing row gets a fresh UUID via the column
-- default). Drop the default so future inserts have to opt in explicitly —
-- prevents accidentally reusing a stale secret across tenants if someone
-- forgets to set one.
alter table tenants
  alter column enquiry_webhook_secret drop default;

-- Lookup pattern: select tenant by slug, then constant-time compare the
-- secret. No index needed since slug already has one.
