-- Make bookings.occupant_id cascade on delete so that removing an occupant
-- automatically removes their bookings (and, via existing cascades on bookings,
-- also removes booking_payments, payment_plans, damage_deposits, feedback, etc.)
alter table bookings
  drop constraint bookings_occupant_id_fkey,
  add constraint bookings_occupant_id_fkey
    foreign key (occupant_id) references occupants(id) on delete cascade;
