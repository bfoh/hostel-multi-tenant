-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 130 — Hotel rooms sell as one unit, not per-bed
--
-- Migration 101 replaced the old no_double_booking exclusion constraint with
-- a capacity-aware trigger allowing up to room_categories.capacity
-- concurrent CONFIRMED bookings on the same physical room — correct for
-- hostel dorms (one room, N beds, N independent bookings) but wrong for
-- hotels, where "Standard Room, capacity 2" means one booking sleeps up to
-- 2 guests, not that 2 different bookings can each claim the room at once.
--
-- This re-defines enforce_room_capacity() to force the effective capacity
-- to 1 for hotel tenants, looked up via bookings.tenant_id (already a
-- column, no extra join needed). Hostel tenants are completely unaffected —
-- business_type <> 'hotel' leaves room_cap exactly as it was.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.enforce_room_capacity()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  active_count int;
  room_cap     int;
  vertical     text;
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

  SELECT business_type INTO vertical FROM public.tenants WHERE id = NEW.tenant_id;

  -- A hotel room is sold as one unit per stay regardless of how many guests
  -- its capacity says it sleeps — only hostel dorm-style rooms (capacity =
  -- number of independently-bookable beds) allow concurrent bookings.
  IF vertical = 'hotel' THEN
    room_cap := 1;
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
