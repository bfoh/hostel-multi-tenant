-- Migration 063 — Allow deleting menu_items with historical orders
--
-- food_order_items.name_snapshot already preserves the item name at order
-- time, so dropping the menu_items reference doesn't lose customer-facing
-- detail. Relax the FK to ON DELETE SET NULL so admins can prune the menu
-- without breaking referential integrity on past orders.

alter table food_order_items
  drop constraint if exists food_order_items_menu_item_id_fkey;

alter table food_order_items
  alter column menu_item_id drop not null;

alter table food_order_items
  add constraint food_order_items_menu_item_id_fkey
    foreign key (menu_item_id) references menu_items(id) on delete set null;
