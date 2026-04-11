-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 037 — Customisable Notification Templates
-- ═══════════════════════════════════════════════════════════════════════════

create table notification_templates (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  event_type   text not null check (event_type in (
                 'booking_confirmed', 'booking_cancelled',
                 'payment_received', 'payment_reminder',
                 'checkin_reminder', 'checkout_reminder',
                 'lease_expiry_reminder', 'deposit_refund'
               )),
  channel      text not null check (channel in ('sms', 'email')),
  subject      text,              -- email only
  body         text not null,     -- supports {{variables}}
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (tenant_id, event_type, channel)
);

create trigger notification_templates_updated_at
  before update on notification_templates
  for each row execute function set_updated_at();

create index on notification_templates (tenant_id, event_type);

alter table notification_templates enable row level security;

create policy "tenant members can manage notification templates"
  on notification_templates for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );
