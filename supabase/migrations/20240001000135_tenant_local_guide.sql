-- Local Guide — a tenant-editable list of nearby places/practical info
-- shown as a read-only tab in the guest portal, ported from AMP Lodge's
-- "Local Guide". Mirrors notices' shape/RLS convention (migration 031) —
-- the closest existing sibling (a simple staff-managed, guest-readable
-- list).
create table tenant_local_guide_entries (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  category    text not null default 'other'
              check (category in ('restaurant', 'attraction', 'transport', 'shopping', 'emergency', 'other')),
  name        text not null,
  note        text,
  distance    text,   -- free text, e.g. "5 min walk" — deliberately not a computed distance
  link        text,
  sort_order  integer not null default 0,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger tenant_local_guide_entries_updated_at
  before update on tenant_local_guide_entries
  for each row execute function set_updated_at();

create index on tenant_local_guide_entries (tenant_id, sort_order);

alter table tenant_local_guide_entries enable row level security;

create policy "tenant members can manage local guide entries"
  on tenant_local_guide_entries for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );
