-- Migration 060 — Food orders, items, carts + tenant settings

do $$ begin
  create type food_order_status as enum ('placed','preparing','ready','picked_up','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type food_payment_method as enum ('online','cash_on_pickup');
exception when duplicate_object then null; end $$;

create table if not exists food_orders (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  occupant_id         uuid not null references occupants(id),
  booking_id          uuid references bookings(id),
  order_ref           text not null,
  status              food_order_status not null default 'placed',
  total_pesewas       integer not null check (total_pesewas > 0),
  payment_method      food_payment_method not null,
  paystack_reference  text,
  paid_at             timestamptz,
  placed_at           timestamptz not null default now(),
  preparing_at        timestamptz,
  ready_at            timestamptz,
  picked_up_at        timestamptz,
  cancelled_at        timestamptz,
  cancelled_reason    text,
  notes               text check (char_length(coalesce(notes, '')) <= 280)
);
create unique index if not exists food_orders_ref on food_orders (tenant_id, order_ref);
create index if not exists food_orders_queue on food_orders (tenant_id, status, placed_at);
create index if not exists food_orders_occupant on food_orders (tenant_id, occupant_id, placed_at desc);

create table if not exists food_order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references food_orders(id) on delete cascade,
  menu_item_id        uuid not null references menu_items(id),
  name_snapshot       text not null,
  quantity            smallint not null check (quantity between 1 and 10),
  unit_price_pesewas  integer not null check (unit_price_pesewas > 0),
  subtotal_pesewas    integer not null check (subtotal_pesewas > 0)
);
create index if not exists food_order_items_order on food_order_items (order_id);

create table if not exists food_carts (
  occupant_id  uuid primary key references occupants(id) on delete cascade,
  tenant_id    uuid not null references tenants(id) on delete cascade,
  items        jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now()
);

alter table food_orders      enable row level security;
alter table food_order_items enable row level security;
alter table food_carts       enable row level security;

drop policy if exists "occupant reads own food orders" on food_orders;
create policy "occupant reads own food orders"
  on food_orders for select to authenticated
  using (occupant_id in (select id from occupants where user_id = auth.uid()));

drop policy if exists "staff reads tenant food orders" on food_orders;
create policy "staff reads tenant food orders"
  on food_orders for select to authenticated
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid() and is_active));

drop policy if exists "items follow order visibility" on food_order_items;
create policy "items follow order visibility"
  on food_order_items for select to authenticated
  using (
    order_id in (
      select id from food_orders fo
       where fo.occupant_id in (select id from occupants where user_id = auth.uid())
          or fo.tenant_id   in (select tenant_id from tenant_members where user_id = auth.uid() and is_active)
    )
  );

drop policy if exists "occupant reads own cart" on food_carts;
create policy "occupant reads own cart"
  on food_carts for select to authenticated
  using (occupant_id in (select id from occupants where user_id = auth.uid()));

alter table tenants
  add column if not exists food_orders_enabled  boolean not null default false,
  add column if not exists food_cutoff_time     time,
  add column if not exists food_ready_sms       boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname='supabase_realtime' and schemaname='public' and tablename='food_orders'
  ) then
    alter publication supabase_realtime add table food_orders;
  end if;
end $$;
