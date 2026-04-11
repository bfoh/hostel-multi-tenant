-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 025 — Room waiting list
-- ═══════════════════════════════════════════════════════════════════════════

create table waiting_list (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  category_id         uuid references room_categories(id) on delete set null,
  occupant_id         uuid references occupants(id) on delete set null,
  -- For non-existing occupants (walk-ins / enquiries)
  contact_name        text,
  contact_phone       text,
  contact_email       text,
  preferred_check_in  date,
  preferred_duration  text,  -- e.g. '1 semester', '3 months'
  notes               text,
  priority            int not null default 0,  -- higher = more priority
  status              text not null default 'waiting'
                      check (status in ('waiting', 'offered', 'converted', 'expired', 'cancelled')),
  offered_room_id     uuid references rooms(id) on delete set null,
  offered_at          timestamptz,
  notified_at         timestamptz,
  expires_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table waiting_list enable row level security;

create policy "waiting_list_tenant" on waiting_list
  for all using (
    exists (select 1 from tenant_members tm
            where tm.tenant_id = waiting_list.tenant_id
              and tm.user_id = auth.uid() and tm.is_active = true)
  );

create index on waiting_list (tenant_id, status);
create index on waiting_list (tenant_id, category_id, status);

create trigger waiting_list_updated_at
  before update on waiting_list
  for each row execute function set_updated_at();
