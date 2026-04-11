-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 020 — Paystack MoMo Payment Tracking
-- Adds paystack_reference to bookings for tracking MoMo charge status.
-- ═══════════════════════════════════════════════════════════════════════════

alter table bookings add column if not exists paystack_reference text;

create index if not exists idx_bookings_paystack_reference on bookings (paystack_reference) where paystack_reference is not null;
