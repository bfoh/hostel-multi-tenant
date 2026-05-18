-- ═══════════════════════════════════════════════════════════════════════════
-- Multi-occupancy rooms
--
-- Before: each booking flipped the room's status to 'reserved' / 'occupied'.
-- That broke any room whose category capacity > 1 (2-in-a-room, 3-in-a-room,
-- 4-in-a-room) — the whole room looked taken after a single booking.
--
-- After: rooms.status only carries manual overrides (available / maintenance
-- / blocked). Effective occupancy is derived from the count of active
-- bookings vs the category's capacity.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. One-time data reset. Anything sitting in 'occupied' or 'reserved' was
--    set there by the old single-booking-fills-room logic and is now wrong.
update rooms
   set status = 'available'
 where status in ('occupied', 'reserved');

-- 2. Bed count helpers
--
--    Active = bookings that hold a bed right now or in the future:
--    pending_confirmation, confirmed, checked_in. We deliberately leave the
--    end-date check open so the count is "currently held", not "currently
--    in-house" — a confirmed future booking still consumes a bed.
create or replace function room_active_bed_count(
  p_room_id uuid,
  p_as_of   date default current_date
)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from bookings
   where room_id        = p_room_id
     and status         in ('pending_confirmation', 'confirmed', 'checked_in')
     and check_out_date >  p_as_of
$$;

create or replace function room_free_bed_count(p_room_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
           0,
           coalesce(c.capacity, 0) - room_active_bed_count(r.id)
         )::int
    from rooms r
    join room_categories c on c.id = r.category_id
   where r.id     = p_room_id
     and r.status not in ('maintenance', 'blocked')
$$;

grant execute on function room_active_bed_count(uuid, date) to service_role, authenticated;
grant execute on function room_free_bed_count(uuid)         to service_role, authenticated;

-- 3. Convenience view: one row per room with derived occupancy fields.
create or replace view room_occupancy_v as
  select
    r.id                                                       as room_id,
    r.tenant_id,
    r.category_id,
    r.room_number,
    r.status                                                   as manual_status,
    c.capacity                                                 as capacity,
    coalesce(
      (select count(*)::int
         from bookings b
        where b.room_id        = r.id
          and b.status         in ('pending_confirmation', 'confirmed', 'checked_in')
          and b.check_out_date >  current_date),
      0
    )                                                          as beds_taken,
    greatest(
      0,
      c.capacity - coalesce(
        (select count(*)::int
           from bookings b
          where b.room_id        = r.id
            and b.status         in ('pending_confirmation', 'confirmed', 'checked_in')
            and b.check_out_date >  current_date),
        0
      )
    )                                                          as free_beds,
    case
      when r.status in ('maintenance', 'blocked') then r.status::text
      when coalesce(
             (select count(*)::int
                from bookings b
               where b.room_id        = r.id
                 and b.status         in ('pending_confirmation', 'confirmed', 'checked_in')
                 and b.check_out_date >  current_date),
             0
           ) >= c.capacity then 'occupied'
      when coalesce(
             (select count(*)::int
                from bookings b
               where b.room_id        = r.id
                 and b.status         in ('pending_confirmation', 'confirmed', 'checked_in')
                 and b.check_out_date >  current_date),
             0
           ) > 0 then 'partial'
      else 'available'
    end                                                        as effective_status
  from rooms r
  join room_categories c on c.id = r.category_id;

grant select on room_occupancy_v to service_role, authenticated;

-- 4. Stale self check-in release no longer needs to free room status, because
--    bookings (not rooms.status) now hold the bed. Cancelling the booking is
--    enough — the bed is released automatically via room_occupancy_v.
create or replace function release_stale_self_checkin_reservations(
  p_tenant_id      uuid,
  p_max_age_minutes int default 30
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cancelled int := 0;
begin
  with stale as (
    update bookings
       set status = 'cancelled'
     where tenant_id                 = p_tenant_id
       and status                    = 'pending_confirmation'
       and payment_status            = 'unpaid'
       and self_checkin_submitted_at is not null
       and self_checkin_submitted_at < now() - make_interval(mins => p_max_age_minutes)
    returning id
  )
  select count(*) into v_cancelled from stale;

  return v_cancelled;
end;
$$;
