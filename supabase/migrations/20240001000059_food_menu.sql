-- Migration 059 — Food menu catalog

create table if not exists menu_categories (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  sort_order  smallint not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists idx_menu_cat_tenant on menu_categories (tenant_id, sort_order);

create table if not exists menu_items (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  category_id     uuid references menu_categories(id) on delete set null,
  name            text not null,
  description     text check (char_length(coalesce(description, '')) <= 500),
  price_pesewas   integer not null check (price_pesewas > 0),
  photo_url       text,
  is_available    boolean not null default true,
  is_sold_out     boolean not null default false,
  publish_date    date,
  sort_order      smallint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_menu_items_today
  on menu_items (tenant_id, publish_date, is_available, sort_order);

alter table menu_categories enable row level security;
alter table menu_items      enable row level security;

drop policy if exists "tenant members read categories" on menu_categories;
create policy "tenant members read categories"
  on menu_categories for select to authenticated
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid() and is_active));

drop policy if exists "occupants read available items" on menu_items;
create policy "occupants read available items"
  on menu_items for select to authenticated
  using (
    is_available
    and (publish_date is null or publish_date = current_date)
    and tenant_id in (select tenant_id from occupants where user_id = auth.uid())
  );

drop policy if exists "tenant members read all items" on menu_items;
create policy "tenant members read all items"
  on menu_items for select to authenticated
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid() and is_active));
