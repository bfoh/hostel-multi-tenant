-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 146 — Payment idempotency and receipt reconciliation
--
-- A UI warning can be bypassed and cannot protect against two concurrent
-- requests. New receipts therefore carry database-enforced retry identity,
-- reference uniqueness, and an exact daily fingerprint for unreferenced
-- manual payments. Existing history is deliberately left reviewable rather
-- than being silently deleted or rewritten.
-- ══════════════════════════════════════════════════════════════════════════════

alter table booking_payments
  add column if not exists idempotency_key text,
  add column if not exists recorded_on date,
  add column if not exists dedupe_enforced boolean;

-- Do not let a new constraint choose a winner among old duplicate-looking
-- rows. They remain visible for human reconciliation; only future writes are
-- made subject to the hard uniqueness guarantees below.
update booking_payments
   set recorded_on = coalesce(recorded_on, paid_at::date, created_at::date),
       dedupe_enforced = coalesce(dedupe_enforced, false)
 where recorded_on is null or dedupe_enforced is null;

alter table booking_payments
  alter column recorded_on set default current_date,
  alter column recorded_on set not null,
  alter column dedupe_enforced set default true,
  alter column dedupe_enforced set not null;

create or replace function prepare_booking_payment_dedupe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_timezone text;
begin
  new.reference := nullif(btrim(new.reference), '');
  new.idempotency_key := nullif(btrim(new.idempotency_key), '');

  select coalesce(t.timezone, 'Africa/Accra')
    into v_timezone
    from tenants t
   where t.id = new.tenant_id;

  if tg_op = 'INSERT' then
    new.dedupe_enforced := true;
    new.recorded_on := (coalesce(new.paid_at, new.created_at, now()) at time zone
      coalesce(v_timezone, 'Africa/Accra'))::date;
  elsif old.status not in ('success', 'reversed') then
    -- Provider and draft rows often begin pending. Enforce the same rules at
    -- the transition to success, using the actual receipt date.
    new.dedupe_enforced := true;
    if new.status = 'success' and old.status is distinct from 'success' then
      new.recorded_on := (coalesce(new.paid_at, now()) at time zone
        coalesce(v_timezone, 'Africa/Accra'))::date;
    end if;
  end if;

  -- Include legacy rows in the lookup so a new write cannot repeat an old
  -- reference even though old duplicate clusters were exempted from the
  -- unique-index build itself.
  if new.dedupe_enforced
     and new.status in ('pending', 'success')
     and new.reference is not null
     and exists (
       select 1
         from booking_payments bp
        where bp.tenant_id = new.tenant_id
          and bp.method = new.method
          and lower(btrim(bp.reference)) = lower(new.reference)
          and bp.status in ('pending', 'success')
          and bp.id is distinct from new.id
     ) then
    raise exception 'Payment reference has already been used'
      using errcode = '23505';
  end if;

  if new.dedupe_enforced
     and new.status = 'success'
     and new.reference is null
     and new.paystack_reference is null
     and new.method <> 'bank_draft'
     and exists (
       select 1
         from booking_payments bp
        where bp.tenant_id = new.tenant_id
          and bp.booking_id = new.booking_id
          and bp.amount = new.amount
          and bp.method = new.method
          and bp.recorded_on = new.recorded_on
          and bp.status = 'success'
          and bp.reference is null
          and bp.paystack_reference is null
          and bp.id is distinct from new.id
     ) then
    raise exception 'A matching unreferenced payment already exists for this booking and date'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke all on function prepare_booking_payment_dedupe()
  from public, anon, authenticated, service_role;

drop trigger if exists prepare_booking_payment_dedupe on booking_payments;
create trigger prepare_booking_payment_dedupe
  before insert or update of status, amount, method, reference, paid_at, paystack_reference
  on booking_payments
  for each row execute function prepare_booking_payment_dedupe();

create unique index if not exists booking_payments_idempotency_key_uidx
  on booking_payments (tenant_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists booking_payments_reference_uidx
  on booking_payments (tenant_id, method, lower(reference))
  where dedupe_enforced
    and status in ('pending', 'success')
    and reference is not null;

-- Bank drafts already have a separate one-pending-submission constraint and
-- online payments have unique provider references. This fingerprint covers
-- new manual/offline receipts that have neither form of external evidence.
create unique index if not exists booking_payments_manual_fingerprint_uidx
  on booking_payments (tenant_id, booking_id, amount, method, recorded_on)
  where dedupe_enforced
    and status = 'success'
    and reference is null
    and paystack_reference is null
    and method <> 'bank_draft';

-- Dedupe evidence is part of immutable posted-payment evidence too.
create or replace function protect_posted_booking_payment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('success', 'reversed') then
      raise exception 'A posted payment cannot be deleted; reverse it instead'
        using errcode = '23514';
    end if;
    return old;
  end if;

  if old.status in ('success', 'reversed') and (
    new.amount is distinct from old.amount
    or new.method is distinct from old.method
    or new.booking_id is distinct from old.booking_id
    or new.tenant_id is distinct from old.tenant_id
    or new.paid_at is distinct from old.paid_at
    or new.reference is distinct from old.reference
    or new.idempotency_key is distinct from old.idempotency_key
    or new.recorded_on is distinct from old.recorded_on
    or new.dedupe_enforced is distinct from old.dedupe_enforced
  ) then
    raise exception 'A posted payment cannot be edited; reverse it and record a replacement'
      using errcode = '23514';
  end if;

  if old.status = 'reversed' and new.status <> 'reversed' then
    raise exception 'A reversed payment is terminal; record a replacement payment'
      using errcode = '23514';
  end if;

  if old.status = 'success' and new.status not in ('success', 'reversed') then
    raise exception 'A successful payment can only be reversed'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Shared implementation for legacy callers and the retry-safe application
-- entry point. The booking row lock serializes balance and duplicate checks.
create or replace function _record_booking_payment_core(
  p_tenant_id uuid,
  p_booking_id uuid,
  p_amount integer,
  p_method text,
  p_reference text,
  p_notes text,
  p_actor_id uuid,
  p_allow_overpayment boolean,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
  v_received bigint;
  v_remaining bigint;
  v_payment booking_payments%rowtype;
  v_reference text := nullif(btrim(p_reference), '');
  v_key text := nullif(btrim(p_idempotency_key), '');
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero' using errcode = '22023';
  end if;
  if v_key is not null and length(v_key) > 200 then
    raise exception 'Payment idempotency key is too long' using errcode = '22023';
  end if;

  perform (p_method::payment_method);

  select * into v_booking
    from bookings
   where id = p_booking_id and tenant_id = p_tenant_id
   for update;

  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  -- This lookup happens after the booking lock. A simultaneous retry waits
  -- for the first transaction and then sees its committed receipt.
  if v_key is not null then
    select * into v_payment
      from booking_payments
     where tenant_id = p_tenant_id and idempotency_key = v_key;

    if found then
      if v_payment.booking_id <> p_booking_id
         or v_payment.amount <> p_amount
         or v_payment.method <> p_method::payment_method
         or v_payment.reference is distinct from v_reference then
        raise exception 'Idempotency key was already used for a different payment'
          using errcode = '23505';
      end if;

      select coalesce(sum(amount), 0) into v_received
        from booking_payments
       where booking_id = v_booking.id and status = 'success';

      return jsonb_build_object(
        'id', v_payment.id,
        'booking_id', v_booking.id,
        'amount', v_payment.amount,
        'paid_amount', v_received,
        'balance', greatest(v_booking.final_amount - v_received, 0),
        'recorded', false,
        'idempotent', true
      );
    end if;
  end if;

  if v_booking.status = 'cancelled' then
    raise exception 'Cannot record a payment on a cancelled booking' using errcode = '23514';
  end if;

  select coalesce(sum(amount), 0) into v_received
    from booking_payments
   where booking_id = v_booking.id and status = 'success';

  -- A distinct external reference is the only supported way to record two
  -- otherwise-identical genuine payments close together. The historical
  -- p_allow_duplicate switch is intentionally no longer honoured.
  if exists (
    select 1
      from booking_payments bp
     where bp.booking_id = v_booking.id
       and bp.status = 'success'
       and bp.amount = p_amount
       and bp.method = p_method::payment_method
       and bp.paid_at >= now() - interval '3 minutes'
       and (
         (v_reference is null and bp.reference is null)
         or lower(bp.reference) = lower(v_reference)
       )
  ) then
    raise exception 'A matching payment already exists; use its receipt or supply a distinct transaction reference'
      using errcode = '23505';
  end if;

  v_remaining := greatest(v_booking.final_amount - v_received, 0);

  if not p_allow_overpayment and p_amount > v_remaining then
    raise exception 'Payment exceeds the outstanding balance (% > %)', p_amount, v_remaining
      using errcode = '22003';
  end if;

  insert into booking_payments (
    tenant_id, booking_id, amount, method, reference, notes,
    status, paid_at, received_by, idempotency_key
  ) values (
    p_tenant_id, v_booking.id, p_amount, p_method::payment_method,
    v_reference, nullif(btrim(p_notes), ''),
    'success', now(), p_actor_id, v_key
  )
  returning * into v_payment;

  if v_received + p_amount >= v_booking.final_amount
     and v_booking.status = 'pending_payment' then
    update bookings set status = 'confirmed' where id = v_booking.id;
  end if;

  return jsonb_build_object(
    'id', v_payment.id,
    'booking_id', v_booking.id,
    'amount', v_payment.amount,
    'paid_amount', v_received + p_amount,
    'balance', greatest(v_booking.final_amount - v_received - p_amount, 0),
    'recorded', true,
    'idempotent', v_key is not null
  );
end;
$$;

revoke all on function _record_booking_payment_core(uuid, uuid, integer, text, text, text, uuid, boolean, text)
  from public, anon, authenticated, service_role;

-- Preserve the established signature for payment plans, bulk actions and
-- older deployments, but remove the duplicate-bypass behaviour.
create or replace function record_booking_payment(
  p_tenant_id uuid,
  p_booking_id uuid,
  p_amount integer,
  p_method text,
  p_reference text default null,
  p_notes text default null,
  p_actor_id uuid default null,
  p_allow_overpayment boolean default false,
  p_allow_duplicate boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return _record_booking_payment_core(
    p_tenant_id, p_booking_id, p_amount, p_method, p_reference, p_notes,
    p_actor_id, p_allow_overpayment, null
  );
end;
$$;

revoke all on function record_booking_payment(uuid, uuid, integer, text, text, text, uuid, boolean, boolean)
  from public, anon, authenticated;
grant execute on function record_booking_payment(uuid, uuid, integer, text, text, text, uuid, boolean, boolean)
  to service_role;

create or replace function record_booking_payment_idempotent(
  p_tenant_id uuid,
  p_booking_id uuid,
  p_amount integer,
  p_method text,
  p_reference text,
  p_notes text,
  p_actor_id uuid,
  p_allow_overpayment boolean,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Payment idempotency key is required' using errcode = '22023';
  end if;

  return _record_booking_payment_core(
    p_tenant_id, p_booking_id, p_amount, p_method, p_reference, p_notes,
    p_actor_id, p_allow_overpayment, p_idempotency_key
  );
end;
$$;

revoke all on function record_booking_payment_idempotent(uuid, uuid, integer, text, text, text, uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function record_booking_payment_idempotent(uuid, uuid, integer, text, text, text, uuid, boolean, text)
  to service_role;

-- Exact booking-level explanation of the all-time receipt/invoice gap.
create or replace function get_unapplied_booking_receipts(p_tenant_id uuid)
returns table (
  booking_id uuid,
  booking_ref text,
  booking_status text,
  occupant_id uuid,
  occupant_name text,
  total_receipts bigint,
  invoice_received bigint,
  unapplied_amount bigint,
  reason text
)
language sql
stable
security definer
set search_path = public
as $$
  with receipt_totals as (
    select
      b.id as booking_id,
      coalesce((
        select sum(bp.amount)::bigint
          from booking_payments bp
         where bp.booking_id = b.id and bp.status = 'success'
      ), 0) as room_receipts,
      coalesce((
        select sum(bc.amount)::bigint
          from booking_charges bc
         where bc.booking_id = b.id and bc.paid
      ), 0) as charge_receipts
    from bookings b
    where b.tenant_id = p_tenant_id
  ), reconciled as (
    select
      b.id,
      b.booking_ref,
      b.status::text as booking_status,
      o.id as occupant_id,
      concat_ws(' ', o.first_name, nullif(o.other_names, ''), o.last_name) as occupant_name,
      (r.room_receipts + r.charge_receipts)::bigint as total_receipts,
      case
        when b.status in ('enquiry', 'cancelled') then 0::bigint
        else (least(r.room_receipts, b.final_amount::bigint) + r.charge_receipts)::bigint
      end as invoice_received,
      r.room_receipts,
      b.final_amount::bigint as final_amount
    from bookings b
    join receipt_totals r on r.booking_id = b.id
    left join occupants o on o.id = b.occupant_id and o.tenant_id = b.tenant_id
    where b.tenant_id = p_tenant_id
  )
  select
    r.id,
    r.booking_ref,
    r.booking_status,
    r.occupant_id,
    r.occupant_name,
    r.total_receipts,
    r.invoice_received,
    (r.total_receipts - r.invoice_received)::bigint,
    case
      when r.booking_status = 'cancelled' then 'cancelled_booking_receipt'
      when r.booking_status = 'enquiry' then 'enquiry_receipt'
      when r.room_receipts > r.final_amount then 'customer_credit'
      else 'unapplied_receipt'
    end
  from reconciled r
  where r.total_receipts > r.invoice_received
  order by (r.total_receipts - r.invoice_received) desc, r.booking_ref;
$$;

revoke all on function get_unapplied_booking_receipts(uuid)
  from public, anon, authenticated;
grant execute on function get_unapplied_booking_receipts(uuid)
  to service_role;
