-- Promote occupants whose lifecycle status drifted from their bookings.
-- Admin check-in via PATCH /api/bookings/[id]/status and bulk set_status
-- previously updated bookings.status only, leaving occupants.status stuck
-- at 'pending' even after they had moved in. Forward fix lives in
-- application code; this migration repairs existing rows.

-- 1. Anyone with an active stay is active.
UPDATE public.occupants o
   SET status = 'active'
 WHERE status = 'pending'
   AND EXISTS (
     SELECT 1 FROM public.bookings b
      WHERE b.occupant_id = o.id
        AND b.status = 'checked_in'
   );

-- 2. Anyone whose last booking ended (no remaining active stay) is checked_out.
UPDATE public.occupants o
   SET status = 'checked_out'
 WHERE status IN ('pending', 'active')
   AND EXISTS (
     SELECT 1 FROM public.bookings b
      WHERE b.occupant_id = o.id
        AND b.status = 'checked_out'
   )
   AND NOT EXISTS (
     SELECT 1 FROM public.bookings b2
      WHERE b2.occupant_id = o.id
        AND b2.status IN ('confirmed', 'checked_in', 'pending_payment')
   );
