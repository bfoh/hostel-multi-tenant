-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 057 — Maintenance Messages
-- Threaded conversation per maintenance_request, plus denormalized counters
-- and realtime publication.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Messages table
create table if not exists maintenance_messages (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  request_id      uuid not null references maintenance_requests(id) on delete cascade,
  author_user_id  uuid references auth.users(id) on delete set null,
  author_kind     text not null check (author_kind in ('occupant', 'staff', 'system')),
  body            text check (char_length(coalesce(body, '')) <= 2000),
  attachments     text[] not null default array[]::text[],
  created_at      timestamptz not null default now()
);

create index if not exists idx_mm_request
  on maintenance_messages (tenant_id, request_id, created_at);

create index if not exists idx_mm_tenant_recent
  on maintenance_messages (tenant_id, created_at desc);

-- 2. Denormalized columns on parent + explicit occupant link
alter table maintenance_requests
  add column if not exists occupant_id     uuid references occupants(id) on delete set null,
  add column if not exists last_message_at timestamptz,
  add column if not exists message_count   int  not null default 0,
  add column if not exists closed_by_kind  text check (closed_by_kind in ('occupant','staff'));

create index if not exists idx_mr_occupant on maintenance_requests (tenant_id, occupant_id);

-- Backfill occupant_id from active booking on the same room
update maintenance_requests mr
   set occupant_id = b.occupant_id
  from bookings b
 where b.tenant_id = mr.tenant_id
   and b.room_id   = mr.room_id
   and b.status in ('checked_in', 'confirmed')
   and mr.occupant_id is null
   and mr.room_id is not null;

-- 3. Trigger to maintain last_message_at + message_count
create or replace function bump_maintenance_request_on_message()
returns trigger
language plpgsql
security definer
as $$
begin
  update maintenance_requests
     set last_message_at = new.created_at,
         message_count   = message_count + 1
   where id = new.request_id;
  return new;
end;
$$;

drop trigger if exists trg_mm_bump_parent on maintenance_messages;
create trigger trg_mm_bump_parent
  after insert on maintenance_messages
  for each row execute function bump_maintenance_request_on_message();

-- 4. RLS
alter table maintenance_messages enable row level security;

drop policy if exists "occupants read own request messages" on maintenance_messages;
create policy "occupants read own request messages"
  on maintenance_messages for select to authenticated
  using (
    request_id in (
      select mr.id
        from maintenance_requests mr
        join occupants o on o.id = mr.occupant_id
       where o.user_id = auth.uid()
    )
  );

drop policy if exists "staff read tenant messages" on maintenance_messages;
create policy "staff read tenant messages"
  on maintenance_messages for select to authenticated
  using (
    tenant_id in (
      select tm.tenant_id from tenant_members tm
       where tm.user_id = auth.uid() and tm.is_active = true
    )
  );

-- (No INSERT/UPDATE/DELETE policies — all writes go through service-role routes.)

-- 5. Realtime publication
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'maintenance_messages'
  ) then
    alter publication supabase_realtime add table maintenance_messages;
  end if;
end $$;
