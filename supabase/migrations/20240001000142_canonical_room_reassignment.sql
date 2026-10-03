-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 142 — Canonical room reassignment
--
-- A booking receives an initial room during booking, but an authorised staff
-- reassignment is the final operational decision. Record that decision,
-- protect it from later generic/system updates, and perform availability
-- validation plus the room change in one locked database transaction.
-- ═══════════════════════════════════════════════════════════════════════════

alter table bookings
  add column if not exists room_assignment_source text not null default 'legacy',
  add column if not exists room_assignment_locked boolean not null default false,
  add column if not exists room_assigned_by uuid references auth.users(id) on delete set null,
  add column if not exists room_assigned_at timestamptz not null default now();

-- Existing room assignments predate assignment provenance. Keep them usable
-- but unlocked so the first deliberate staff reassignment can supersede them.
update bookings
   set room_assignment_source = coalesce(room_assignment_source, 'legacy'),
       room_assignment_locked = coalesce(room_assignment_locked, false),
       room_assigned_at       = coalesce(room_assigned_at, created_at, now())
 where room_assignment_source is null
    or room_assignment_locked is null
    or room_assigned_at is null;

alter table bookings
  alter column room_assignment_source set default 'booking',
  alter column room_assignment_source set not null,
  alter column room_assignment_locked set default false,
  alter column room_assignment_locked set not null,
  alter column room_assigned_at set default now(),
  alter column room_assigned_at set not null;

alter table bookings
  drop constraint if exists bookings_room_assignment_source_check;

alter table bookings
  add constraint bookings_room_assignment_source_check check (
    room_assignment_source in ('legacy', 'booking', 'staff_reassignment', 'stay_extension')
  );

alter table bookings
  drop constraint if exists bookings_locked_room_assignment_check;

alter table bookings
  add constraint bookings_locked_room_assignment_check check (
    not room_assignment_locked
    or room_assignment_source in ('staff_reassignment', 'stay_extension')
  );

-- Serialize capacity checks per room. The earlier count-then-write trigger
-- was correct in a single transaction but two concurrent requests could both
-- observe the last bed as free. The advisory transaction lock closes that
-- race for booking creation, reassignment, and date/status changes alike.
create or replace function public.enforce_room_capacity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  active_count       int;
  room_cap           int;
  vertical           text;
  new_effective_from date;
begin
  if new.status in ('cancelled', 'no_show', 'checked_out') then
    return new;
  end if;

  if new.room_id is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.room_id::text, 0));

  select rc.capacity, t.business_type
    into room_cap, vertical
    from rooms r
    join room_categories rc on rc.id = r.category_id
    join tenants t on t.id = new.tenant_id
   where r.id = new.room_id
     and r.tenant_id = new.tenant_id;

  if not found then
    raise exception 'Room does not belong to the booking tenant'
      using errcode = '23503';
  end if;

  if room_cap is null or room_cap <= 0 then
    return new;
  end if;

  if vertical = 'hotel' then
    room_cap := 1;
  end if;

  -- A checked-in transfer changes the current room, not where the guest was
  -- housed in the past. Capacity therefore starts today for in-house stays.
  new_effective_from := case
    when new.status = 'checked_in' then greatest(new.check_in_date, current_date)
    else new.check_in_date
  end;

  select count(*)
    into active_count
    from bookings b
   where b.tenant_id = new.tenant_id
     and b.room_id   = new.room_id
     and b.id       <> new.id
     and b.status   not in ('cancelled', 'no_show', 'checked_out')
     and daterange(
           case
             when b.status = 'checked_in' then greatest(b.check_in_date, current_date)
             else b.check_in_date
           end,
           b.check_out_date,
           '[)'
         ) && daterange(new_effective_from, new.check_out_date, '[)');

  if active_count + 1 > room_cap then
    raise exception
      'Room % is at capacity (% beds) for the requested dates [% .. %)',
      new.room_id, room_cap, new_effective_from, new.check_out_date
      using errcode = '23P01';
  end if;

  return new;
end;
$$;

-- Once staff have deliberately assigned a room, a generic update that only
-- changes room_id must not silently undo their decision. Deliberate staff
-- workflows advance the assignment timestamp and carry actor provenance.
create or replace function protect_manual_room_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.room_assignment_locked
     and new.room_id is distinct from old.room_id
     and not (
       new.room_assignment_locked
       and new.room_assignment_source in ('staff_reassignment', 'stay_extension')
       and new.room_assigned_by is not null
       and new.room_assigned_at > old.room_assigned_at
     ) then
    raise exception 'A staff-assigned room can only be changed by an authorised reassignment workflow'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_manual_room_assignment on bookings;
create trigger protect_manual_room_assignment
  before update of room_id on bookings
  for each row execute function protect_manual_room_assignment();

-- Canonical application entry point. The booking row lock protects against a
-- concurrent status/room change, while the capacity trigger serializes all
-- claims against the destination room.
create or replace function reassign_booking_room(
  p_tenant_id       uuid,
  p_booking_id      uuid,
  p_new_room_id     uuid,
  p_reason          text,
  p_actor_id        uuid,
  p_expected_room_id uuid default null,
  p_expected_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking         bookings%rowtype;
  v_previous_room_id uuid;
  v_old_room_number text;
  v_new_room_number text;
  v_new_room_status text;
  v_reason          text;
begin
  if p_actor_id is null then
    raise exception 'The staff member performing the reassignment is required'
      using errcode = '22023';
  end if;

  v_reason := coalesce(nullif(btrim(p_reason), ''), 'Room reassigned by staff');

  select *
    into v_booking
    from bookings
   where id = p_booking_id
     and tenant_id = p_tenant_id
   for update;

  if not found then
    raise exception 'Booking not found'
      using errcode = 'P0002';
  end if;

  if v_booking.status not in ('pending_confirmation', 'pending_payment', 'confirmed', 'checked_in') then
    raise exception 'Booking cannot be reassigned from status %', v_booking.status
      using errcode = '23514';
  end if;

  if p_expected_status is not null
     and v_booking.status::text <> p_expected_status then
    raise exception 'Booking status changed from the expected value (% -> %)',
      p_expected_status, v_booking.status
      using errcode = '40001';
  end if;

  if p_expected_room_id is not null
     and v_booking.room_id is distinct from p_expected_room_id then
    raise exception 'Booking room changed while the reassignment was being prepared'
      using errcode = '40001';
  end if;

  if v_booking.room_id = p_new_room_id then
    return jsonb_build_object(
      'changed', false,
      'id', v_booking.id,
      'status', v_booking.status,
      'room_id', v_booking.room_id
    );
  end if;

  select r.room_number, r.status::text
    into v_new_room_number, v_new_room_status
    from rooms r
   where r.id = p_new_room_id
     and r.tenant_id = p_tenant_id;

  if not found then
    raise exception 'New room not found'
      using errcode = 'P0002';
  end if;

  if v_new_room_status in ('maintenance', 'blocked') then
    raise exception 'New room is not available'
      using errcode = '23514';
  end if;

  select room_number
    into v_old_room_number
    from rooms
   where id = v_booking.room_id
     and tenant_id = p_tenant_id;

  v_previous_room_id := v_booking.room_id;

  update bookings
     set room_id                = p_new_room_id,
         room_assignment_source = 'staff_reassignment',
         room_assignment_locked = true,
         room_assigned_by       = p_actor_id,
         room_assigned_at       = clock_timestamp(),
         notes                  = concat_ws(
           E'\n',
           nullif(notes, ''),
           '[Room reassignment: Room ' || coalesce(v_old_room_number, 'unassigned') ||
           ' → Room ' || v_new_room_number || '] ' || left(v_reason, 500)
         )
   where id = v_booking.id
  returning * into v_booking;

  insert into audit_log (
    tenant_id, actor_id, action, entity_type, entity_id, description,
    old_values, new_values
  ) values (
    p_tenant_id,
    p_actor_id,
    'booking.room_reassigned',
    'booking',
    v_booking.id,
    'Booking ' || v_booking.booking_ref || ' reassigned from Room ' ||
      coalesce(v_old_room_number, 'unassigned') || ' to Room ' || v_new_room_number,
    jsonb_build_object('room_id', v_previous_room_id, 'room_number', v_old_room_number),
    jsonb_build_object(
      'room_id', p_new_room_id,
      'room_number', v_new_room_number,
      'reason', v_reason,
      'assignment_source', 'staff_reassignment'
    )
  );

  return jsonb_build_object(
    'changed', true,
    'id', v_booking.id,
    'booking_ref', v_booking.booking_ref,
    'status', v_booking.status,
    'previous_room_id', v_previous_room_id,
    'previous_room_number', v_old_room_number,
    'room_id', v_booking.room_id,
    'room_number', v_new_room_number,
    'reason', v_reason,
    'room_assignment_source', v_booking.room_assignment_source,
    'room_assigned_at', v_booking.room_assigned_at
  );
end;
$$;

revoke all on function reassign_booking_room(uuid, uuid, uuid, text, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function reassign_booking_room(uuid, uuid, uuid, text, uuid, uuid, text)
  to service_role;
