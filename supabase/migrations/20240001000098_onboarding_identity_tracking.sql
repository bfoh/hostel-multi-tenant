-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 098 — Onboarding identity checkpoint + ops lead notification
--
-- Tracks when a new tenant finishes the first wizard step (Identity), and
-- records whether the platform-ops notification email has been sent so we
-- never double-fire even if the wizard retries the save.
-- ═══════════════════════════════════════════════════════════════════════════

alter table tenants
  add column if not exists identity_completed_at timestamptz,
  add column if not exists lead_notified_at      timestamptz;

comment on column tenants.identity_completed_at is
  'Timestamp when the owner finished step 1 (Identity) of the onboarding wizard.';

comment on column tenants.lead_notified_at is
  'Timestamp when the new-tenant lead notification email was dispatched to platform ops.';
