-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 039 — Occupant ID Verification Status
-- ═══════════════════════════════════════════════════════════════════════════

-- Add verification fields to occupants
alter table occupants
  add column if not exists id_verified        boolean not null default false,
  add column if not exists id_verified_at     timestamptz,
  add column if not exists id_verified_by     uuid references auth.users(id) on delete set null,
  add column if not exists id_rejection_notes text;

-- Verification review log (history of review decisions)
create table id_verification_reviews (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  occupant_id  uuid not null references occupants(id) on delete cascade,
  document_id  uuid references occupant_documents(id) on delete set null,
  decision     text not null check (decision in ('approved', 'rejected', 'needs_resubmission')),
  notes        text,
  reviewed_by  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index on id_verification_reviews (tenant_id, created_at desc);
create index on id_verification_reviews (occupant_id);

alter table id_verification_reviews enable row level security;

create policy "tenant members can manage verification reviews"
  on id_verification_reviews for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );
