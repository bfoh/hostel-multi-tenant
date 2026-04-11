-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 010 — Bank Reconciliation
-- bank_statements: uploaded CSV rows from bank/MoMo statements
-- reconciliation_matches: links statement rows to journal_lines
-- ═══════════════════════════════════════════════════════════════════════════

create type recon_status as enum ('unmatched', 'matched', 'excluded', 'manual');

-- ── Bank statement rows (one row per CSV transaction) ─────────────────────

create table bank_statements (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  upload_id    uuid not null,                  -- groups rows from same upload
  txn_date     date not null,
  description  text not null,
  debit        integer not null default 0,     -- pesewas
  credit       integer not null default 0,     -- pesewas
  balance      integer,                        -- pesewas (running balance, optional)
  reference    text,                           -- bank/MoMo reference number
  status       recon_status not null default 'unmatched',
  matched_entry_id uuid references journal_entries(id),
  matched_line_id  uuid references journal_lines(id),
  notes        text,
  uploaded_at  timestamptz not null default now(),

  check (debit >= 0 and credit >= 0),
  check (debit > 0 or credit > 0)
);

create index on bank_statements (tenant_id, status);
create index on bank_statements (tenant_id, txn_date desc);
create index on bank_statements (tenant_id, upload_id);

alter table bank_statements enable row level security;

create policy "tenant_read_bank_statements"
  on bank_statements for select
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid()));

create policy "tenant_write_bank_statements"
  on bank_statements for all
  using (
    tenant_id in (
      select tenant_id from tenant_members
      where user_id = auth.uid() and role in ('owner', 'manager', 'accountant')
    )
  );
