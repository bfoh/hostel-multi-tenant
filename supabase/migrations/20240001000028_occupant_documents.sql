-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 028 — Occupant document storage
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists occupant_documents (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  occupant_id   uuid not null references occupants(id) on delete cascade,
  document_type text not null
                check (document_type in ('ghana_card', 'passport', 'voters_id', 'nhis',
                                         'tenancy_agreement', 'offer_letter', 'photo', 'other')),
  file_name     text not null,
  file_url      text not null,   -- Supabase Storage signed/public URL
  file_size     int,             -- bytes
  mime_type     text,
  notes         text,
  uploaded_by   uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

alter table occupant_documents enable row level security;

drop policy if exists "occupant_documents_tenant" on occupant_documents;
create policy "occupant_documents_tenant" on occupant_documents
  for all using (
    exists (select 1 from tenant_members tm
            where tm.tenant_id = occupant_documents.tenant_id
              and tm.user_id = auth.uid() and tm.is_active = true)
  );

create index if not exists occupant_documents_occupant_id_idx on occupant_documents (occupant_id);
create index if not exists occupant_documents_tenant_id_idx on occupant_documents (tenant_id);

-- Supabase Storage bucket for documents (create via dashboard or CLI):
-- bucket name: occupant-documents
-- public: false (signed URLs)
