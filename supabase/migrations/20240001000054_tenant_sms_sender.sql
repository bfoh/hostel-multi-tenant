-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 054 — Tenant-scoped SMS sender ID
-- Lets each tenant brand outbound SMS with their own pre-approved Arkesel
-- sender ID, falling back to the platform-wide ARKESEL_SENDER_ID when null.
-- ═══════════════════════════════════════════════════════════════════════════

alter table tenants add column if not exists sms_sender_id text;

-- Arkesel rules: 1–11 chars, alphanumeric; hyphen is also accepted by
-- Arkesel even though their docs sometimes say otherwise — leave punctuation
-- validation to the application layer so existing approved IDs (e.g.
-- "GH-Hostels") still fit.
alter table tenants
  add constraint tenants_sms_sender_id_length
  check (sms_sender_id is null or char_length(sms_sender_id) between 1 and 11);
