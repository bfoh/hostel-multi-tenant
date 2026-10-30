-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 147 — Webhook event outbox
--
-- Settings → Webhooks offers ten event types, but only booking.cancelled was
-- ever sent (from lib/bookings/cancel-booking.ts). The other states change in
-- dozens of places — staff routes, the public/widget/AI booking flows, bulk
-- import, kiosk, Paystack settlement inside SQL functions — so emitting from
-- application code would always miss some of them.
--
-- Instead, row triggers write one 'pending' webhook_events row per subscribed
-- endpoint in the same transaction as the change (a transactional outbox).
-- /api/cron/webhook-deliveries claims pending rows with
-- claim_webhook_events(), signs and POSTs them, and records the outcome;
-- migration 148 schedules it every minute.
--
--   booking.created        bookings insert
--   booking.confirmed      bookings status enters 'confirmed'   (insert or update)
--   booking.checked_in     bookings status enters 'checked_in'  (insert or update)
--   booking.checked_out    bookings status enters 'checked_out' (insert or update)
--   payment.received       booking_payments status enters 'success'
--   maintenance.created    maintenance_requests insert
--   maintenance.resolved   maintenance_requests status enters 'completed'
--   occupant.created       occupants insert
--
-- booking.cancelled stays in cancel-booking.ts, which sends the reason and
-- source that the row alone doesn't carry; it is deliberately not emitted
-- here so receivers never get it twice.
--
-- Enqueueing never blocks the business write: any error is downgraded to a
-- warning. Amounts in payloads are pesewas, as everywhere else.
-- ═══════════════════════════════════════════════════════════════════════════

create index if not exists webhook_events_pending_idx
  on webhook_events (created_at)
  where status = 'pending';

-- ── Enqueue ──────────────────────────────────────────────────────────────────

create or replace function enqueue_webhook_event(
  p_tenant_id  uuid,
  p_event_type text,
  p_data       jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into webhook_events (tenant_id, endpoint_id, event_type, payload, status, attempts, created_at)
  select p_tenant_id,
         ep.id,
         p_event_type,
         jsonb_build_object('event', p_event_type, 'data', p_data),
         'pending',
         0,
         -- clock_timestamp() keeps events from one transaction in the order
         -- they happened (booking.created before booking.confirmed).
         clock_timestamp()
    from webhook_endpoints ep
   where ep.tenant_id = p_tenant_id
     and ep.is_active
     and (p_event_type = any (ep.events) or '*' = any (ep.events));
exception when others then
  raise warning 'enqueue_webhook_event(%, %) failed: %', p_tenant_id, p_event_type, sqlerrm;
end;
$$;

revoke all on function enqueue_webhook_event(uuid, text, jsonb) from public, anon, authenticated;

-- ── Bookings ─────────────────────────────────────────────────────────────────

create or replace function webhook_booking_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data jsonb;
begin
  v_data := jsonb_build_object(
    'booking_id',     new.id,
    'booking_ref',    new.booking_ref,
    'status',         new.status,
    'source',         new.source,
    'room_id',        new.room_id,
    'occupant_id',    new.occupant_id,
    'check_in_date',  new.check_in_date,
    'check_out_date', new.check_out_date,
    'rate_unit',      new.rate_unit,
    'total_amount',   new.total_amount,
    'final_amount',   new.final_amount,
    'paid_amount',    new.paid_amount,
    'payment_status', new.payment_status
  );

  if tg_op = 'INSERT' then
    perform enqueue_webhook_event(new.tenant_id, 'booking.created', v_data);
  end if;

  if new.status::text in ('confirmed', 'checked_in', 'checked_out')
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform enqueue_webhook_event(new.tenant_id, 'booking.' || new.status::text, v_data);
  end if;

  return null;
end;
$$;

drop trigger if exists bookings_webhook_events on bookings;
create trigger bookings_webhook_events
  after insert or update of status on bookings
  for each row execute function webhook_booking_events();

-- ── Booking payments ─────────────────────────────────────────────────────────

create or replace function webhook_payment_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'success'
     and (tg_op = 'INSERT' or old.status is distinct from 'success') then
    perform enqueue_webhook_event(new.tenant_id, 'payment.received', jsonb_build_object(
      'payment_id',         new.id,
      'booking_id',         new.booking_id,
      'amount',             new.amount,
      'method',             new.method,
      'reference',          new.reference,
      'paystack_reference', new.paystack_reference,
      'paid_at',            new.paid_at
    ));
  end if;
  return null;
end;
$$;

drop trigger if exists booking_payments_webhook_events on booking_payments;
create trigger booking_payments_webhook_events
  after insert or update of status on booking_payments
  for each row execute function webhook_payment_events();

-- ── Maintenance requests ─────────────────────────────────────────────────────

create or replace function webhook_maintenance_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data jsonb;
begin
  v_data := jsonb_build_object(
    'maintenance_id', new.id,
    'ref_number',     new.ref_number,
    'title',          new.title,
    'category',       new.category,
    'priority',       new.priority,
    'status',         new.status,
    'room_id',        new.room_id,
    'occupant_id',    new.occupant_id,
    'resolved_at',    new.resolved_at
  );

  if tg_op = 'INSERT' then
    perform enqueue_webhook_event(new.tenant_id, 'maintenance.created', v_data);
  end if;

  if new.status::text = 'completed'
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform enqueue_webhook_event(new.tenant_id, 'maintenance.resolved', v_data);
  end if;

  return null;
end;
$$;

drop trigger if exists maintenance_requests_webhook_events on maintenance_requests;
create trigger maintenance_requests_webhook_events
  after insert or update of status on maintenance_requests
  for each row execute function webhook_maintenance_events();

-- ── Occupants ────────────────────────────────────────────────────────────────

-- Name and contact details only; identity documents, date of birth and
-- emergency contacts are never sent.
create or replace function webhook_occupant_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform enqueue_webhook_event(new.tenant_id, 'occupant.created', jsonb_build_object(
    'occupant_id', new.id,
    'type',        new.type,
    'status',      new.status,
    'first_name',  new.first_name,
    'last_name',   new.last_name,
    'email',       new.email,
    'phone',       new.phone
  ));
  return null;
end;
$$;

drop trigger if exists occupants_webhook_events on occupants;
create trigger occupants_webhook_events
  after insert on occupants
  for each row execute function webhook_occupant_events();

-- ── Delivery claim ───────────────────────────────────────────────────────────

-- Hands the delivery worker up to p_limit due events and marks them as being
-- attempted. SKIP LOCKED lets overlapping runs share the queue without
-- sending an event twice. Retries back off 1, 4, 16, 64 and 256 minutes; the
-- worker marks an event 'failed' after its sixth attempt. Events whose
-- endpoint was deleted cascade away; ones whose endpoint was paused are
-- returned with is_active = false so the worker can close them out.
create or replace function claim_webhook_events(p_limit integer default 50)
returns table (
  id          uuid,
  tenant_id   uuid,
  endpoint_id uuid,
  event_type  text,
  payload     jsonb,
  attempts    smallint,
  created_at  timestamptz,
  url         text,
  secret      text,
  is_active   boolean
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  return query
  with due as (
    select e.id
      from webhook_events e
     where e.status = 'pending'
       and (e.last_attempted_at is null
            or e.last_attempted_at < now() - interval '1 minute' * power(4, greatest(e.attempts - 1, 0)))
     order by e.created_at
     limit greatest(p_limit, 0)
     for update skip locked
  ),
  claimed as (
    update webhook_events e
       set attempts = e.attempts + 1,
           last_attempted_at = now()
      from due
     where e.id = due.id
    returning e.id, e.tenant_id, e.endpoint_id, e.event_type, e.payload, e.attempts, e.created_at
  )
  select c.id, c.tenant_id, c.endpoint_id, c.event_type, c.payload, c.attempts, c.created_at,
         ep.url, ep.secret, ep.is_active
    from claimed c
    join webhook_endpoints ep on ep.id = c.endpoint_id
   order by c.created_at;
end;
$$;

revoke all on function claim_webhook_events(integer) from public, anon, authenticated;
grant execute on function claim_webhook_events(integer) to service_role;
