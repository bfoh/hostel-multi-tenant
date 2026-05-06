-- Migration 062 — Food order channels (resident / walk-in / online)

do $$ begin
  create type food_order_channel as enum ('resident', 'walk_in', 'online');
exception when duplicate_object then null; end $$;

alter table food_orders
  add column if not exists customer_kind  food_order_channel not null default 'resident',
  add column if not exists table_label    text,
  add column if not exists tracking_token text,
  add constraint food_orders_table_label_len check (table_label is null or char_length(table_label) <= 40);

create unique index if not exists food_orders_tracking_token
  on food_orders (tracking_token)
  where tracking_token is not null;
