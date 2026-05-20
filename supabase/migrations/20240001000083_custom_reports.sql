-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 083 — Custom report definitions
--
-- Lets accountants save reusable report specs (account scope + period
-- preset + grouping) and re-run them without rebuilding the filter each
-- time. The definition is stored as JSONB so future report types can be
-- added without further migrations.
-- ═══════════════════════════════════════════════════════════════════════════

create table custom_reports (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  name         text not null,
  description  text,
  definition   jsonb not null,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index on custom_reports (tenant_id, created_at desc);

create trigger custom_reports_updated_at
  before update on custom_reports
  for each row execute function set_updated_at();

alter table custom_reports enable row level security;

create policy "tenant members read custom reports"
  on custom_reports for select
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid()));
