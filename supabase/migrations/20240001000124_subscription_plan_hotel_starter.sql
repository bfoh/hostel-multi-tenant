-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 124 — Add 'hotel_starter' to subscription_plan
--
-- Hotel-vertical plan tiers (lib/platform-plans.ts) are prefixed rather than
-- reusing 'starter'/'growth', which stay implicitly hostel-only and require
-- touching nothing already in production. tenants.plan is this enum, and the
-- activate_tenant_on_subscription trigger (migration 049) writes
-- `new.plan_name::subscription_plan` on every successful subscription — so a
-- hotel tenant subscribing to "Hotel Starter" would fail that cast without
-- this value existing first.
--
-- Must be its own migration: Postgres forbids using a freshly added enum
-- value inside the same transaction that added it, and Supabase applies each
-- migration file as one transaction (same reasoning as migration 118).
-- ═══════════════════════════════════════════════════════════════════════════

alter type subscription_plan add value 'hotel_starter';
