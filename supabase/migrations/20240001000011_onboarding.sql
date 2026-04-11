-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 012 — Onboarding completion flag
-- Tracks whether the new-tenant onboarding wizard has been completed.
-- ═══════════════════════════════════════════════════════════════════════════

alter table tenants
  add column if not exists onboarding_completed boolean not null default false;

-- Existing tenants (who are already live) are marked as complete so they
-- don't get sent through the wizard on next login.
update tenants set onboarding_completed = true where onboarding_completed = false;
