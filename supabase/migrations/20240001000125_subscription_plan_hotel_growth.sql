-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 125 — Add 'hotel_growth' to subscription_plan
--
-- See migration 124's header for the full rationale. Split into its own
-- migration for the same reason: each ADD VALUE needs its own transaction.
-- ═══════════════════════════════════════════════════════════════════════════

alter type subscription_plan add value 'hotel_growth';
