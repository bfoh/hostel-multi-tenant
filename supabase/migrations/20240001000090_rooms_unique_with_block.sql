-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 090 — Make rooms uniqueness include block
--
-- Multi-block hostels reuse room numbers per block (e.g. "1, 2, 3" in
-- Block A and again in Block B). The original unique constraint
-- (tenant_id, room_number) blocked bulk imports with this layout and
-- triggered Postgres "ON CONFLICT DO UPDATE command cannot affect row
-- a second time" when the CSV touched the same room_number twice in
-- different blocks.
--
-- This migration:
--   1. Backfills NULL block to '' so the new unique constraint enforces
--      both blocked and unblocked rooms cleanly
--   2. Defaults block to '' going forward
--   3. Swaps the unique constraint to (tenant_id, block, room_number)
--   4. Refreshes the related index
-- ═══════════════════════════════════════════════════════════════════════════

update rooms set block = '' where block is null;

alter table rooms
  alter column block set default '',
  alter column block set not null;

alter table rooms drop constraint if exists rooms_tenant_id_room_number_key;
alter table rooms add  constraint rooms_tenant_block_room_unique
  unique (tenant_id, block, room_number);
