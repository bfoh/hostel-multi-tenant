-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 026 — Visitor passes (QR check-in)
-- ═══════════════════════════════════════════════════════════════════════════

-- Create visitor_logs table (base table for security / gate log)
create table if not exists visitor_logs (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  visitor_name   text not null,
  visitor_phone  text,
  host_name      text,
  room_id        uuid references rooms(id) on delete set null,
  purpose        text,
  checked_in_at  timestamptz not null default now(),
  checked_out_at timestamptz,
  notes          text,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists visitor_logs_tenant_id on visitor_logs (tenant_id);
create index if not exists visitor_logs_checked_in_at on visitor_logs (tenant_id, checked_in_at desc);

-- RLS
alter table visitor_logs enable row level security;

create policy "tenant members can manage visitor logs"
  on visitor_logs for all
  using (
    tenant_id in (
      select tenant_id from tenant_members where user_id = auth.uid()
    )
  );

-- Add pass token + expected arrival columns
alter table visitor_logs
  add column if not exists pass_token    text unique default encode(gen_random_bytes(12), 'hex'),
  add column if not exists expected_at   timestamptz,
  add column if not exists pass_used_at  timestamptz,
  add column if not exists pass_status   text not null default 'active'
    check (pass_status in ('active', 'used', 'expired', 'revoked'));

create index if not exists visitor_logs_pass_token on visitor_logs (pass_token);
