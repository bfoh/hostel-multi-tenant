-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 087 — Declining-balance depreciation method
--
-- Adds 'declining_balance' to the depreciation_method enum and a
-- declining_factor column on assets so the multiplier (e.g. 2.0 for
-- standard double-declining-balance) is configurable per asset.
--
-- Monthly depreciation under DB is:
--   monthly_rate = (declining_factor / useful_life_months)
--   monthly_dep  = current_book_value × monthly_rate
-- where current_book_value = purchase_price − accumulated_depreciation
-- and depreciation is clamped so net book never drops below salvage.
-- ═══════════════════════════════════════════════════════════════════════════

alter type depreciation_method add value if not exists 'declining_balance';

alter table assets
  add column if not exists declining_factor numeric(4, 2) not null default 2.0
    check (declining_factor > 0);
