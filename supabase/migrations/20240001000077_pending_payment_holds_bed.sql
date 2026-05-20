-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 077 — pending_payment bookings hold a bed
--
-- Before: room_occupancy_v counted only ('pending_confirmation','confirmed',
-- 'checked_in') as bed-holding. Public bookings start as 'pending_payment'
-- (created before Paystack callback confirms), so the bed showed as free
-- between booking creation and payment confirmation — a race window where
-- two concurrent visitors could both grab the same last bed.
--
-- After: 'pending_payment' is also a bed-holding status. To avoid abandoned
-- Paystack flows holding beds forever, a stale-release function cancels
-- pending_payment+unpaid public bookings older than p_max_age_minutes.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Include 'pending_payment' in the bed-count helper.
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
     and status         in ('pending_payment', 'pending_confirmation', 'confirmed', 'checked_in')
     and check_out_date >  p_as_of
$$;

-- 2. Rebuild the view with the expanded hold set.
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
          and b.status         in ('pending_payment', 'pending_confirmation', 'confirmed', 'checked_in')
          and b.check_out_date >  current_date),
      0
    )                                                          as beds_taken,
    greatest(
      0,
      c.capacity - coalesce(
        (select count(*)::int
           from bookings b
          where b.room_id        = r.id
            and b.status         in ('pending_payment', 'pending_confirmation', 'confirmed', 'checked_in')
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
                 and b.status         in ('pending_payment', 'pending_confirmation', 'confirmed', 'checked_in')
                 and b.check_out_date >  current_date),
             0
           ) >= c.capacity then 'occupied'
      when coalesce(
             (select count(*)::int
                from bookings b
               where b.room_id        = r.id
                 and b.status         in ('pending_payment', 'pending_confirmation', 'confirmed', 'checked_in')
                 and b.check_out_date >  current_date),
             0
           ) > 0 then 'partial'
      else 'available'
    end                                                        as effective_status
  from rooms r
  join room_categories c on c.id = r.category_id;

grant select on room_occupancy_v to service_role, authenticated;

-- 3. Release abandoned public-booking holds. Public bookings hit
--    /api/public/[slug]/book → status='pending_payment' → guest is sent to
--    Paystack. If guest never completes payment, the booking sits unpaid
--    forever and holds a bed. Cancel anything older than p_max_age_minutes.
--
--    Tenant-scoped and idempotent. Returns the number of bookings cancelled.
create or replace function release_stale_pending_payment_bookings(
  p_tenant_id       uuid,
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
     where tenant_id      = p_tenant_id
       and status         = 'pending_payment'
       and payment_status = 'unpaid'
       and source         = 'website'
       and created_at     < now() - make_interval(mins => p_max_age_minutes)
    returning id
  )
  select count(*) into v_cancelled from stale;

  return v_cancelled;
end;
$$;

grant execute on function release_stale_pending_payment_bookings(uuid, int)
  to service_role, authenticated;
