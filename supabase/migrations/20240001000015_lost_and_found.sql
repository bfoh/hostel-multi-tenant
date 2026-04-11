-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 016 — Lost & Found Register
-- ═══════════════════════════════════════════════════════════════════════════

create type lf_status as enum ('unclaimed', 'claimed', 'disposed', 'donated');

create table lost_found_items (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,

  -- Item
  description   text not null check (char_length(description) between 1 and 500),
  category      text not null default 'other'
                  check (category in ('electronics','clothing','documents','keys','money','jewellery','bag','other')),
  found_date    date not null,
  found_location text,                  -- e.g. "Room 12", "Common room"
  image_url     text,                   -- optional photo

  -- Occupant link (if identified)
  occupant_id   uuid references occupants(id) on delete set null,
  room_id       uuid references rooms(id) on delete set null,

  -- Resolution
  status        lf_status not null default 'unclaimed',
  claimed_by    text,                   -- name if not an occupant in system
  claimed_at    timestamptz,
  notes         text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger lf_items_updated_at
  before update on lost_found_items
  for each row execute function set_updated_at();

create index on lost_found_items (tenant_id);
create index on lost_found_items (tenant_id, status);
create index on lost_found_items (tenant_id, found_date desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table lost_found_items enable row level security;

create policy "tenant members can manage lost & found"
  on lost_found_items
  using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = lost_found_items.tenant_id
        and tm.user_id   = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = lost_found_items.tenant_id
        and tm.user_id   = auth.uid()
    )
  );
