-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 021 — Web Push Subscriptions
-- Stores browser push subscription objects per user/tenant.
-- ═══════════════════════════════════════════════════════════════════════════

create table push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null,
  p256dh       text not null,   -- client public key
  auth_key     text not null,   -- auth secret
  user_agent   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (tenant_id, user_id, endpoint)
);

create index on push_subscriptions (tenant_id);
create index on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- Users can only manage their own subscriptions
create policy "push_subscriptions_own"
  on push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger push_subscriptions_updated_at
  before update on push_subscriptions
  for each row execute function set_updated_at();
