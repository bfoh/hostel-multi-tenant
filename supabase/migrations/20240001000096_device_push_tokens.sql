-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 096 — device_push_tokens
--
-- Per-device push tokens for the native mobile app (Capacitor). Used by
-- apps/web/lib/push/fanout.ts to send via FCM HTTP v1 (Android native +
-- iOS via APNs proxied through Firebase).
--
-- Web-push (web_push_subscriptions) remains in use for browsers — this
-- table is native-only.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists device_push_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  tenant_id     uuid references tenants(id) on delete cascade,
  platform      text not null check (platform in ('ios','android')),
  token         text not null,
  app_version   text,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (token)
);

create index if not exists device_push_tokens_user_idx   on device_push_tokens(user_id);
create index if not exists device_push_tokens_tenant_idx on device_push_tokens(tenant_id);

alter table device_push_tokens enable row level security;

-- Users can only see / manage their own tokens. Service role bypasses RLS
-- for fanout in lib/push/fanout.ts.
create policy device_push_tokens_self_select on device_push_tokens
  for select using (auth.uid() = user_id);

create policy device_push_tokens_self_insert on device_push_tokens
  for insert with check (auth.uid() = user_id);

create policy device_push_tokens_self_update on device_push_tokens
  for update using (auth.uid() = user_id);

create policy device_push_tokens_self_delete on device_push_tokens
  for delete using (auth.uid() = user_id);
