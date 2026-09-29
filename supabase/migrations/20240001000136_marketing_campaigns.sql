-- Marketing campaigns — bulk SMS/email blasts to occupants from a saved
-- draft, ported from AMP Lodge's Marketing page. Distinct from the
-- existing 1:1 Communications/Messages feature. No per-recipient
-- tracking table: both providers this app already integrates with
-- (Arkesel SMS, Brevo email) accept a batch of recipients in one API call
-- and return one aggregate result, not a per-recipient delivery status —
-- so there is nothing a per-recipient row would ever let the UI show that
-- the aggregate recipient_count/status below doesn't already cover.
create table marketing_campaigns (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  name            text not null,
  channel         text not null check (channel in ('sms', 'email')),
  subject         text,   -- email only
  body            text not null,
  audience        text not null default 'all_occupants'
                  check (audience in ('all_occupants', 'active_occupants', 'past_guests')),
  status          text not null default 'draft' check (status in ('draft', 'sent', 'failed')),
  recipient_count integer not null default 0,
  sent_at         timestamptz,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger marketing_campaigns_updated_at
  before update on marketing_campaigns
  for each row execute function set_updated_at();

create index on marketing_campaigns (tenant_id, created_at desc);

alter table marketing_campaigns enable row level security;

create policy "tenant members can manage marketing campaigns"
  on marketing_campaigns for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );
