-- Create empty stub tables for relations that compute_daily_report
-- depends on but that have not been deployed in their full form yet.
-- The function only counts() / filters them, so an empty table with
-- the referenced columns is enough to unblock the digest.
--
-- When the real bank-drafts and maintenance modules ship, their own
-- migrations should `create table if not exists` over these stubs
-- and add the rest of the columns.

create table if not exists public.bank_draft_submissions (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  status      text not null default 'submitted',
  created_at  timestamptz not null default now()
);
create index if not exists bank_draft_submissions_tenant_status
  on public.bank_draft_submissions (tenant_id, status);

alter table public.bank_draft_submissions enable row level security;
drop policy if exists "tenant members read bank drafts" on public.bank_draft_submissions;
create policy "tenant members read bank drafts"
  on public.bank_draft_submissions for select
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid()));

create table if not exists public.maintenance_requests (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  status        text not null default 'open',
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists maintenance_requests_tenant_status
  on public.maintenance_requests (tenant_id, status);

alter table public.maintenance_requests enable row level security;
drop policy if exists "tenant members read maintenance" on public.maintenance_requests;
create policy "tenant members read maintenance"
  on public.maintenance_requests for select
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid()));
