-- Make food_orders.occupant_id cascade on delete so that removing an occupant
-- also removes their food orders (and, via the existing cascade on
-- food_order_items.order_id, their order line items).
alter table food_orders
  drop constraint food_orders_occupant_id_fkey,
  add constraint food_orders_occupant_id_fkey
    foreign key (occupant_id) references occupants(id) on delete cascade;
