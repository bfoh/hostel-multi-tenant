-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 031 — Notice Board
-- ═══════════════════════════════════════════════════════════════════════════

create table notices (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  title        text not null,
  body         text not null,
  category     text not null default 'general'
               check (category in ('general','urgent','maintenance','payment','event')),
  is_pinned    boolean not null default false,
  published_at timestamptz not null default now(),
  expires_at   timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger notices_updated_at
  before update on notices
  for each row execute function set_updated_at();

create index on notices (tenant_id, published_at desc);
create index on notices (tenant_id, is_pinned, published_at desc);

alter table notices enable row level security;

create policy "tenant members can manage notices"
  on notices for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );
