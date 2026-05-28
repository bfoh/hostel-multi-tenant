-- Repair bookings stuck with payment_status='paid' but status='pending_payment'.
-- Caused by bulk mark_paid + installment/webhook handlers that updated
-- payment_status without promoting the lifecycle status. Forward fix lives in
-- application code; this migration cleans the existing data.
--
-- Some rooms have an overlapping confirmed booking already, so a blanket UPDATE
-- trips the `no_double_booking` exclusion constraint. We promote row-by-row
-- and skip any conflicts; those rows stay flagged for manual review.

DO $$
DECLARE
  r          record;
  promoted   int := 0;
  conflicted int := 0;
BEGIN
  FOR r IN
    SELECT id, booking_ref, room_id, check_in_date, check_out_date
    FROM public.bookings
    WHERE payment_status = 'paid'
      AND status         = 'pending_payment'
  LOOP
    BEGIN
      UPDATE public.bookings SET status = 'confirmed' WHERE id = r.id;
      promoted := promoted + 1;
    EXCEPTION WHEN exclusion_violation THEN
      conflicted := conflicted + 1;
      RAISE NOTICE 'Skipped booking % (ref %): overlaps with another confirmed booking on room % for [% .. %)',
        r.id, r.booking_ref, r.room_id, r.check_in_date, r.check_out_date;
    END;
  END LOOP;

  RAISE NOTICE 'Backfill done: % promoted, % skipped (overlap conflicts).',
    promoted, conflicted;
END $$;
