-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 085 — Multi-currency on expenses
--
-- Mirrors the currency capture added to supplier_bills in migration 080,
-- so paid-on-spot expenses recorded in foreign currency also retain their
-- original amount + the FX rate used at capture.
-- ═══════════════════════════════════════════════════════════════════════════

alter table expenses
  add column if not exists currency_code   text default 'GHS',
  add column if not exists original_amount integer,
  add column if not exists fx_rate_used    numeric(14, 6);

comment on column expenses.amount is
  'Base-currency (GHS) amount — derived from original_amount × fx_rate_used at capture if foreign currency';
