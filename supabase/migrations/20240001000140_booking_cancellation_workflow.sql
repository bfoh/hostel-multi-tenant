-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 140 — Canonical booking cancellation workflow
--
-- Cancellation used to be performed by several unrelated UPDATE statements.
-- Some paths omitted the timestamp/reason, skipped notifications, or allowed
-- a terminal/checked-in booking to be rewritten. This migration establishes
-- the database invariants and exposes one service-role-only RPC used by every
-- application cancellation path.
-- ════════════════════════════════════════════════════════════════════════════

alter table bookings
  add column if not exists cancellation_source text,
  add column if not exists cancelled_by uuid references auth.users(id);

-- A successful payment can arrive after an abandoned hold was cancelled
-- (for example, a guest leaves a Paystack tab open). Preserve the financial
-- record but put it in an explicit resolution queue instead of silently
-- leaving a paid+cancelled booking unexplained.
create table if not exists booking_payment_exceptions (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenants(id) on delete cascade,
  booking_id         uuid not null references bookings(id) on delete cascade,
  paystack_reference text not null,
  exception_type     text not null check (exception_type in ('late_payment_after_cancellation')),
  status             text not null default 'open' check (status in ('open', 'booking_restored', 'refund_required', 'refunded', 'dismissed')),
  amount             integer not null check (amount > 0),
  details            jsonb not null default '{}'::jsonb,
  resolved_by        uuid references auth.users(id),
  resolved_at        timestamptz,
  created_at         timestamptz not null default now(),
  unique (tenant_id, paystack_reference, exception_type)
);

create index if not exists booking_payment_exceptions_open_idx
  on booking_payment_exceptions (tenant_id, created_at desc)
  where status = 'open';

alter table booking_payment_exceptions enable row level security;

create policy "finance staff can read booking payment exceptions"
  on booking_payment_exceptions for select
  using (
    tenant_id = public.tenant_id()
    and public.tenant_role() in ('owner', 'manager', 'accountant')
  );

create policy "managers can resolve booking payment exceptions"
  on booking_payment_exceptions for update
  using (
    tenant_id = public.tenant_id()
    and public.tenant_role() in ('owner', 'manager')
  )
  with check (
    tenant_id = public.tenant_id()
    and public.tenant_role() in ('owner', 'manager')
  );

alter table bookings
  drop constraint if exists bookings_cancellation_source_check;

alter table bookings
  add constraint bookings_cancellation_source_check check (
    cancellation_source is null or cancellation_source in (
      'staff',
      'bulk',
      'group',
      'payment_expired',
      'self_checkin_expired',
      'self_checkin_rejected',
      'ai_assistant',
      'guest',
      'legacy'
    )
  );

-- Preserve legacy rows without pretending that the system knows why or who
-- cancelled them. updated_at is the best timestamp available on old rows.
update bookings
   set cancelled_at        = coalesce(cancelled_at, updated_at),
       cancellation_reason = coalesce(nullif(btrim(cancellation_reason), ''),
                                      'Legacy cancellation — reason not recorded'),
       cancellation_source = coalesce(cancellation_source, 'legacy')
 where status = 'cancelled';

create or replace function normalize_booking_cancellation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Cancellation is terminal. Other lifecycle transitions are validated by
  -- their dedicated application workflows; notably, the existing renewal
  -- workflow intentionally reactivates a checked-out stay after extending it.
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'A cancelled booking cannot change status'
      using errcode = '23514';
  end if;

  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    if old.status not in ('enquiry', 'pending_confirmation', 'pending_payment', 'confirmed') then
      raise exception 'Booking cannot be cancelled from status %', old.status
        using errcode = '23514';
    end if;

    new.cancelled_at        := coalesce(new.cancelled_at, now());
    new.cancellation_reason := coalesce(nullif(btrim(new.cancellation_reason), ''),
                                        'Cancellation reason not provided');
    new.cancellation_source := coalesce(new.cancellation_source, 'staff');
    new.hold_expires_at     := null;
  elsif new.status in ('confirmed', 'checked_in', 'checked_out', 'no_show') then
    new.hold_expires_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_booking_cancellation on bookings;
create trigger normalize_booking_cancellation
  before update of status on bookings
  for each row execute function normalize_booking_cancellation();

-- The only application entry point for cancelling one booking. The row lock
-- makes status validation and the mutation atomic, while expected_status
-- protects the UI from overwriting a concurrent check-in/payment transition.
create or replace function cancel_booking(
  p_tenant_id      uuid,
  p_booking_id     uuid,
  p_reason         text,
  p_source         text,
  p_actor_id       uuid default null,
  p_expected_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
  v_previous_status text;
begin
  if nullif(btrim(p_reason), '') is null then
    raise exception 'A cancellation reason is required'
      using errcode = '22023';
  end if;

  if p_source not in (
    'staff', 'bulk', 'group', 'payment_expired', 'self_checkin_expired',
    'self_checkin_rejected', 'ai_assistant', 'guest', 'legacy'
  ) then
    raise exception 'Invalid cancellation source: %', p_source
      using errcode = '22023';
  end if;

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

  if v_booking.status = 'cancelled' then
    return jsonb_build_object(
      'changed', false,
      'id', v_booking.id,
      'previous_status', v_booking.status,
      'status', v_booking.status
    );
  end if;

  if v_booking.status not in ('enquiry', 'pending_confirmation', 'pending_payment', 'confirmed') then
    raise exception 'Booking cannot be cancelled from status %', v_booking.status
      using errcode = '23514';
  end if;

  if p_expected_status is not null
     and v_booking.status::text <> p_expected_status then
    raise exception 'Booking status changed from the expected value (% -> %)',
      p_expected_status, v_booking.status
      using errcode = '40001';
  end if;

  v_previous_status := v_booking.status::text;

  update bookings
     set status              = 'cancelled',
         cancelled_at        = now(),
         cancellation_reason = left(btrim(p_reason), 500),
         cancellation_source = p_source,
         cancelled_by        = p_actor_id,
         hold_expires_at     = null
   where id = v_booking.id
  returning * into v_booking;

  return jsonb_build_object(
    'changed', true,
    'id', v_booking.id,
    'booking_ref', v_booking.booking_ref,
    'previous_status', v_previous_status,
    'status', v_booking.status,
    'cancelled_at', v_booking.cancelled_at,
    'cancellation_reason', v_booking.cancellation_reason,
    'cancellation_source', v_booking.cancellation_source
  );
end;
$$;

revoke all on function cancel_booking(uuid, uuid, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function cancel_booking(uuid, uuid, text, text, uuid, text)
  to service_role;

-- Keep the two legacy tenant-scoped sweep RPCs safe during a rolling deploy.
-- The application cron supersedes them, but old instances may briefly call
-- them after this migration has landed.
create or replace function release_stale_pending_payment_bookings(
  p_tenant_id uuid,
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
       set status              = 'cancelled',
           cancelled_at        = now(),
           cancellation_reason = 'Online payment was not completed before the hold expired',
           cancellation_source = 'payment_expired',
           hold_expires_at     = null
     where tenant_id      = p_tenant_id
       and status         = 'pending_payment'
       and payment_status = 'unpaid'
       and source in ('website', 'widget', 'voice_ai')
       and coalesce(
             hold_expires_at,
             created_at + make_interval(mins => p_max_age_minutes)
           ) < now()
    returning id
  )
  select count(*) into v_cancelled from stale;

  return v_cancelled;
end;
$$;

create or replace function release_stale_self_checkin_reservations(
  p_tenant_id uuid,
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
       set status              = 'cancelled',
           cancelled_at        = now(),
           cancellation_reason = 'Self check-in was not completed before the hold expired',
           cancellation_source = 'self_checkin_expired',
           hold_expires_at     = null
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

-- Give lifecycle entries exact event names and attach the cancelling actor and
-- metadata. The trigger remains the final safety net, regardless of caller.
create or replace function trg_audit_booking_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    insert into audit_log (
      tenant_id, action, entity_type, entity_id, description, new_values
    ) values (
      new.tenant_id,
      'booking.created',
      'booking',
      new.id,
      'Booking ' || new.booking_ref || ' created',
      jsonb_build_object('status', new.status, 'booking_ref', new.booking_ref)
    );
  elsif tg_op = 'UPDATE' and old.status <> new.status then
    v_action := case new.status
      when 'confirmed'   then 'booking.confirmed'
      when 'checked_in'  then 'booking.checked_in'
      when 'checked_out' then 'booking.checked_out'
      when 'cancelled'   then 'booking.cancelled'
      when 'no_show'     then 'booking.no_show'
      else 'booking.status_changed'
    end;

    insert into audit_log (
      tenant_id, actor_id, action, entity_type, entity_id, description,
      old_values, new_values
    ) values (
      new.tenant_id,
      case when new.status = 'cancelled' then new.cancelled_by else null end,
      v_action,
      'booking',
      new.id,
      'Booking ' || new.booking_ref || ' status changed from ' || old.status || ' to ' || new.status,
      jsonb_build_object('status', old.status),
      jsonb_strip_nulls(jsonb_build_object(
        'status', new.status,
        'reason', new.cancellation_reason,
        'source', new.cancellation_source,
        'cancelled_at', new.cancelled_at
      ))
    );
  end if;

  return coalesce(new, old);
end;
$$;
