-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 034 — Webhook Outbox
-- ═══════════════════════════════════════════════════════════════════════════

create table webhook_endpoints (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  url         text not null,
  secret      text not null default encode(gen_random_bytes(20), 'hex'),
  events      text[] not null default '{}',   -- ['booking.created', 'payment.received', ...]
  is_active   boolean not null default true,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger webhook_endpoints_updated_at
  before update on webhook_endpoints
  for each row execute function set_updated_at();

create index on webhook_endpoints (tenant_id, is_active);

create table webhook_events (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  endpoint_id      uuid not null references webhook_endpoints(id) on delete cascade,
  event_type       text not null,
  payload          jsonb not null default '{}',
  status           text not null default 'pending'
                   check (status in ('pending','delivered','failed')),
  attempts         smallint not null default 0,
  response_status  smallint,
  response_body    text,
  last_attempted_at timestamptz,
  delivered_at     timestamptz,
  created_at       timestamptz not null default now()
);

create index on webhook_events (tenant_id, created_at desc);
create index on webhook_events (endpoint_id, created_at desc);
create index on webhook_events (tenant_id, status);

alter table webhook_endpoints enable row level security;
alter table webhook_events     enable row level security;

create policy "tenant members can manage webhook endpoints"
  on webhook_endpoints for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );

create policy "tenant members can read webhook events"
  on webhook_events for select
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );
