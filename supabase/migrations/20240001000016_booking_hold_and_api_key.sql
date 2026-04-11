-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 017 — Booking hold timer + Public API key
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Booking provisional hold ──────────────────────────────────────────────────
-- Tracks when a widget booking hold expires (default 15 min).
-- Expired holds can be cleaned up by a background job.
alter table bookings
  add column if not exists hold_expires_at timestamptz;

create index if not exists idx_bookings_hold_expires_at
  on bookings (hold_expires_at)
  where hold_expires_at is not null;

-- ── Per-tenant public API key ─────────────────────────────────────────────────
-- Used to authenticate programmatic access to public API endpoints.
-- Generated server-side; stored as a hash (sha256) in future — plain for now.
alter table tenants
  add column if not exists public_api_key text unique;
