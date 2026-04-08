-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 005 — Tenant contact & address fields
-- Adds hostel profile fields used on invoices, receipts, and the booking page.
-- ═══════════════════════════════════════════════════════════════════════════

alter table tenants
  add column if not exists contact_phone   text,
  add column if not exists contact_email   text,
  add column if not exists address_line1   text,
  add column if not exists address_city    text,
  add column if not exists address_region  text,
  add column if not exists website_url     text,
  add column if not exists tagline         text;    -- shown on invoices below hostel name
