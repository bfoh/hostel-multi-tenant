-- Replace the `no_double_booking` exclusion constraint with a capacity-aware
-- trigger. The old constraint forbade ANY overlapping booking on the same
-- (room_id, daterange), which is wrong for shared rooms (3-IN-A, 4-IN-A, etc.)
-- where multiple occupants legitimately share the same room within their
-- capacity.
--
-- New rule: an active booking is allowed only if the count of overlapping
-- active bookings (including itself) does not exceed room_categories.capacity.
-- "Active" = status NOT IN ('cancelled', 'no_show', 'checked_out').

-- 1. Drop the old constraint -------------------------------------------------
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS no_double_booking;

-- 2. Capacity-enforcement function ------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_room_capacity()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  active_count int;
  room_cap     int;
BEGIN
  -- Inactive statuses never compete for a bed.
  IF NEW.status IN ('cancelled', 'no_show', 'checked_out') THEN
    RETURN NEW;
  END IF;

  -- A null room (unassigned booking / enquiry) cannot violate capacity.
  IF NEW.room_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT rc.capacity
    INTO room_cap
    FROM public.rooms r
    JOIN public.room_categories rc ON rc.id = r.category_id
   WHERE r.id = NEW.room_id;

  -- Unknown room or missing capacity → fall through (FK will catch bad room).
  IF room_cap IS NULL OR room_cap <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT count(*)
    INTO active_count
    FROM public.bookings
   WHERE room_id   = NEW.room_id
     AND id       <> NEW.id
     AND status   NOT IN ('cancelled', 'no_show', 'checked_out')
     AND daterange(check_in_date, check_out_date, '[)')
      && daterange(NEW.check_in_date, NEW.check_out_date, '[)');

  IF active_count + 1 > room_cap THEN
    RAISE EXCEPTION
      'Room % is at capacity (% beds) for the requested dates [% .. %)',
      NEW.room_id, room_cap, NEW.check_in_date, NEW.check_out_date
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END
$$;

-- 3. Trigger -----------------------------------------------------------------
DROP TRIGGER IF EXISTS bookings_enforce_capacity ON public.bookings;

CREATE TRIGGER bookings_enforce_capacity
BEFORE INSERT OR UPDATE OF status, room_id, check_in_date, check_out_date
ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_room_capacity();

-- 4. Backfill the rows that were stuck because of the old constraint ---------
UPDATE public.bookings
   SET status = 'confirmed'
 WHERE payment_status = 'paid'
   AND status         = 'pending_payment';
