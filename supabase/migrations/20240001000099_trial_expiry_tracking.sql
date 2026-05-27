-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 099 — Trial expiry warning + suspension tracking
--
-- Adds columns the trial-expiry cron uses to send warning emails idempotently
-- (T-3 days, T-1 day) and to record the moment a trial was suspended for
-- non-payment. The cron job reads these to skip already-notified tenants
-- and writes them after each successful email or suspension.
-- ═══════════════════════════════════════════════════════════════════════════

alter table tenants
  add column if not exists trial_warning_3d_sent_at timestamptz,
  add column if not exists trial_warning_1d_sent_at timestamptz,
  add column if not exists trial_expired_at         timestamptz;

comment on column tenants.trial_warning_3d_sent_at is
  'Set when the 3-day-before-trial-end warning email was dispatched. Used by the trial-expiry cron to skip already-notified tenants.';

comment on column tenants.trial_warning_1d_sent_at is
  'Set when the 1-day-before-trial-end warning email was dispatched.';

comment on column tenants.trial_expired_at is
  'Set when the cron flipped the tenant from trial to suspended for an expired trial without payment.';

-- Index speeds the cron sweep — tiny table now, but the cron runs hourly.
create index if not exists tenants_trial_ends_at_idx
  on tenants (trial_ends_at)
  where status = 'trial';
