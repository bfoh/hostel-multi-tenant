-- Self check-in flow reserves a room before Paystack collects payment.
-- Abandoned / failed submissions leave the room stuck in 'reserved' and
-- the booking stuck in 'pending_confirmation' with payment_status='unpaid'.
--
-- Cancels bookings that have been sitting unpaid for more than
-- p_max_age_minutes and frees their rooms. Idempotent + tenant-scoped.

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
  v_freed int := 0;
begin
  with stale as (
    select b.id as booking_id, b.room_id
    from   bookings b
    where  b.tenant_id                 = p_tenant_id
      and  b.status                    = 'pending_confirmation'
      and  b.payment_status            = 'unpaid'
      and  b.self_checkin_submitted_at is not null
      and  b.self_checkin_submitted_at < now() - make_interval(mins => p_max_age_minutes)
  ),
  cancel_bookings as (
    update bookings
       set status = 'cancelled'
      from stale
     where bookings.id = stale.booking_id
    returning bookings.id
  ),
  free_rooms as (
    update rooms
       set status = 'available'
      from stale
     where rooms.id        = stale.room_id
       and rooms.tenant_id = p_tenant_id
       and rooms.status    = 'reserved'
    returning rooms.id
  )
  select count(*) into v_freed from free_rooms;

  return v_freed;
end;
$$;

grant execute on function release_stale_self_checkin_reservations(uuid, int)
  to service_role, authenticated;
