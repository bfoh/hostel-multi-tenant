-- Stock-quantity tracking for revenue_point_items (e.g. a mini-mart's
-- individual SKUs), wired into the ALREADY EXISTING revenue_point_sales
-- insert path rather than a new module. `inventory_items`/
-- `inventory_movements` (migration 088) were reconstructed schema that no
-- app code ever wired up — no rows exist, so repointing
-- inventory_movements.item_id at revenue_point_items instead of the
-- never-used inventory_items is a pure no-op for any live data.
--
-- stock_qty is nullable: null means "not stock-tracked" (services, gym
-- passes, laundry-by-weight, etc.) and is left alone by the trigger below.
alter table revenue_point_items
  add column stock_qty integer,
  add column reorder_point integer not null default 0 check (reorder_point >= 0);

alter table inventory_movements
  drop constraint inventory_movements_item_id_fkey;

alter table inventory_movements
  add constraint inventory_movements_item_id_fkey
  foreign key (item_id) references revenue_point_items(id) on delete cascade;

-- A sale already writes exactly one revenue_point_sales row (both the
-- staff POS and the guest QR walk-in flow funnel through the same insert)
-- — decrementing stock here covers both call sites with zero app-code
-- change. Stock is clamped at 0 rather than blocking the sale: the POS
-- already lets staff sell without a live stock check today, and a
-- shortfall is a discrepancy to reconcile via Restock, not a reason to
-- refuse a sale that already happened at the counter.
create or replace function adjust_revenue_point_item_stock()
returns trigger language plpgsql as $$
declare
  v_stock_qty integer;
begin
  if new.item_id is null then return new; end if;

  select stock_qty into v_stock_qty from revenue_point_items where id = new.item_id;
  if v_stock_qty is null then return new; end if;  -- not stock-tracked

  update revenue_point_items
     set stock_qty = greatest(0, stock_qty - new.quantity::integer)
   where id = new.item_id;

  insert into inventory_movements
    (tenant_id, item_id, movement_type, quantity, moved_at, created_by, reference)
  values
    (new.tenant_id, new.item_id, 'usage', -new.quantity::integer, new.sold_at::date, new.sold_by, new.id::text);

  return new;
end;
$$;

create trigger revenue_point_sale_adjust_stock
  after insert on revenue_point_sales
  for each row execute function adjust_revenue_point_item_stock();
