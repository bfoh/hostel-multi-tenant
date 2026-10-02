-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 138 — Check-in/check-out reminder idempotency tracking
--
-- Per-tenant "last sent" date for the daily arrivals/departures reminder
-- cron (app/api/cron/checkin-checkout-reminder), mirroring the established
-- per-tenant timestamp-column idempotency pattern used for trial-expiry
-- warnings (trial_warning_3d_sent_at etc. in migration 000).
-- ═══════════════════════════════════════════════════════════════════════════

alter table tenants
  add column if not exists checkin_reminder_last_sent_date date;
