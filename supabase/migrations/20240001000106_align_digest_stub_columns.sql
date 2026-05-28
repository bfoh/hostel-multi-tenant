-- The previous stub used `create table if not exists` for
-- maintenance_requests and bank_draft_submissions, but the table
-- already existed in this database under an older schema that lacked
-- the columns compute_daily_report reads. The stub was therefore a
-- no-op and the next test_run still failed with
-- "column completed_at does not exist".
--
-- Add the columns idempotently so the digest aggregation can compile
-- regardless of what shape the pre-existing tables had.

alter table public.maintenance_requests
  add column if not exists tenant_id    uuid references public.tenants(id) on delete cascade,
  add column if not exists status       text not null default 'open',
  add column if not exists completed_at timestamptz,
  add column if not exists created_at   timestamptz not null default now();

alter table public.bank_draft_submissions
  add column if not exists tenant_id    uuid references public.tenants(id) on delete cascade,
  add column if not exists status       text not null default 'submitted',
  add column if not exists created_at   timestamptz not null default now();

create index if not exists maintenance_requests_tenant_status
  on public.maintenance_requests (tenant_id, status);

create index if not exists bank_draft_submissions_tenant_status
  on public.bank_draft_submissions (tenant_id, status);
