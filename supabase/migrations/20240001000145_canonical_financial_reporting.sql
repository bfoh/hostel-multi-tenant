-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 145 — Canonical financial reporting
--
-- Financial screens must aggregate in PostgreSQL rather than downloading an
-- arbitrary number of payment rows. This keeps dashboard, reports, staff
-- revenue and shift close-out figures complete after the REST row limit is
-- reached and gives every caller the same definition of booking receipts.
-- ═══════════════════════════════════════════════════════════════════════════

-- Extending a stay changes the invoice and may collect payment at the same
-- moment. Keep both changes in one transaction so a payment failure cannot
-- leave the booking total increased without its receipt (or vice versa).
create or replace function extend_booking_stay_with_payments(
  p_tenant_id uuid,
  p_booking_id uuid,
  p_new_check_out_date date,
  p_new_room_id uuid,
  p_payments jsonb,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
  v_extra_amount bigint;
  v_paid_now bigint;
  v_payment jsonb;
  v_payment_result jsonb;
  v_payment_ids jsonb := '[]'::jsonb;
  v_target_room uuid;
begin
  if p_actor_id is null then
    raise exception 'The staff member extending the stay is required'
      using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_payments, '[]'::jsonb)) <> 'array' then
    raise exception 'Payments must be a JSON array' using errcode = '22023';
  end if;

  select * into v_booking
    from bookings
   where id = p_booking_id and tenant_id = p_tenant_id
   for update;

  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if v_booking.status not in ('confirmed', 'checked_in') then
    raise exception 'Only confirmed or checked-in stays can be extended'
      using errcode = '23514';
  end if;

  if p_new_check_out_date <= v_booking.check_out_date then
    raise exception 'New check-out date must be after the current check-out date'
      using errcode = '22023';
  end if;

  v_target_room := coalesce(p_new_room_id, v_booking.room_id);
  v_extra_amount := case
    when v_booking.rate_unit = 'night'
      then (p_new_check_out_date - v_booking.check_out_date)::bigint * v_booking.rate_per_unit
    else 0
  end;

  select coalesce(sum((item ->> 'amount')::bigint), 0)
    into v_paid_now
    from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) item;

  if exists (
    select 1
      from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) item
     where nullif(item ->> 'amount', '') is null
        or (item ->> 'amount')::bigint <= 0
        or nullif(item ->> 'method', '') is null
  ) then
    raise exception 'Each extension payment requires a positive amount and method'
      using errcode = '22023';
  end if;

  if v_paid_now > v_extra_amount then
    raise exception 'The payment total exceeds the extension amount'
      using errcode = '22003';
  end if;

  update bookings
     set check_out_date = p_new_check_out_date,
         total_amount = total_amount + v_extra_amount,
         room_id = v_target_room,
         room_assignment_source = case
           when v_target_room is distinct from v_booking.room_id then 'stay_extension'
           else room_assignment_source
         end,
         room_assignment_locked = case
           when v_target_room is distinct from v_booking.room_id then true
           else room_assignment_locked
         end,
         room_assigned_by = case
           when v_target_room is distinct from v_booking.room_id then p_actor_id
           else room_assigned_by
         end,
         room_assigned_at = case
           when v_target_room is distinct from v_booking.room_id then clock_timestamp()
           else room_assigned_at
         end
   where id = v_booking.id
  returning * into v_booking;

  for v_payment in
    select value from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb))
  loop
    v_payment_result := record_booking_payment(
      p_tenant_id,
      v_booking.id,
      (v_payment ->> 'amount')::integer,
      v_payment ->> 'method',
      null,
      'Extension payment',
      p_actor_id,
      false,
      true
    );
    v_payment_ids := v_payment_ids || jsonb_build_array(v_payment_result ->> 'id');
  end loop;

  return jsonb_build_object(
    'id', v_booking.id,
    'room_id', v_booking.room_id,
    'check_out_date', v_booking.check_out_date,
    'total_amount', v_booking.total_amount,
    'final_amount', v_booking.final_amount,
    'extra_amount', v_extra_amount,
    'paid_now', v_paid_now,
    'payment_ids', v_payment_ids
  );
end;
$$;

revoke all on function extend_booking_stay_with_payments(uuid, uuid, date, uuid, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function extend_booking_stay_with_payments(uuid, uuid, date, uuid, jsonb, uuid)
  to service_role;

-- "Undo approval" must not rewrite a posted bank-draft receipt back to
-- pending. Reverse the immutable receipt and create a new pending review row
-- carrying the same uploaded evidence instead.
create or replace function undo_bank_draft_approval(
  p_tenant_id uuid,
  p_payment_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment booking_payments%rowtype;
  v_replacement booking_payments%rowtype;
begin
  select * into v_payment
    from booking_payments
   where id = p_payment_id
     and tenant_id = p_tenant_id
     and method = 'bank_draft'
     and status = 'success'
     and approved_at > now() - interval '5 minutes'
   for update;

  if not found then
    raise exception 'Undo window expired or draft is no longer approved'
      using errcode = 'P0002';
  end if;

  update booking_payments
     set status = 'reversed'
   where id = v_payment.id;

  insert into booking_payments (
    tenant_id, booking_id, amount, method, reference, status,
    draft_file_path, draft_bank_name, draft_number, draft_deposit_date,
    draft_note, notes, received_by
  ) values (
    v_payment.tenant_id, v_payment.booking_id, v_payment.amount,
    v_payment.method, v_payment.reference, 'pending',
    v_payment.draft_file_path, v_payment.draft_bank_name,
    v_payment.draft_number, v_payment.draft_deposit_date,
    v_payment.draft_note,
    concat_ws(E'\n', nullif(v_payment.notes, ''),
      'Approval undone; replacement draft pending review'),
    p_actor_id
  )
  returning * into v_replacement;

  return jsonb_build_object(
    'reversed_payment_id', v_payment.id,
    'pending_payment_id', v_replacement.id,
    'status', v_replacement.status
  );
end;
$$;

revoke all on function undo_bank_draft_approval(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function undo_bank_draft_approval(uuid, uuid, uuid)
  to service_role;

create or replace function get_booking_receipt_breakdown(
  p_tenant_id uuid,
  p_from      timestamptz,
  p_to        timestamptz,
  p_staff_id  uuid default null
)
returns table (
  collector_id      uuid,
  source            text,
  method            text,
  total_amount      bigint,
  transaction_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with receipts as (
    select
      bp.received_by as collector_id,
      'room_payment'::text as source,
      bp.method::text as method,
      bp.amount::bigint as amount
    from booking_payments bp
    where bp.tenant_id = p_tenant_id
      and bp.status = 'success'
      and bp.paid_at >= p_from
      and bp.paid_at < p_to
      and (p_staff_id is null or bp.received_by = p_staff_id)

    union all

    select
      bc.created_by as collector_id,
      'booking_charge'::text as source,
      bc.payment_method::text as method,
      bc.amount::bigint as amount
    from booking_charges bc
    where bc.tenant_id = p_tenant_id
      and bc.paid
      and bc.updated_at >= p_from
      and bc.updated_at < p_to
      and (p_staff_id is null or bc.created_by = p_staff_id)
  )
  select
    r.collector_id,
    r.source,
    coalesce(r.method, 'unspecified') as method,
    coalesce(sum(r.amount), 0)::bigint as total_amount,
    count(*)::bigint as transaction_count
  from receipts r
  group by r.collector_id, r.source, coalesce(r.method, 'unspecified')
  order by r.collector_id nulls last, r.source, method;
$$;

revoke all on function get_booking_receipt_breakdown(uuid, timestamptz, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function get_booking_receipt_breakdown(uuid, timestamptz, timestamptz, uuid)
  to service_role;

-- Recognized booking revenue is the net movement in revenue accounts, not a
-- second calculation over mutable booking status. This makes operational
-- reports reconcile to the general ledger and preserves closed periods:
-- receipts recognize revenue on their posting date, while later reversals or
-- cancellations appear as negative revenue on their own posting date.
create or replace function get_booking_revenue_breakdown(
  p_tenant_id uuid,
  p_from      timestamptz,
  p_to        timestamptz
)
returns table (
  source            text,
  method            text,
  total_amount      bigint,
  transaction_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      (p_from at time zone coalesce(t.timezone, 'Africa/Accra'))::date as starts_on,
      (p_to at time zone coalesce(t.timezone, 'Africa/Accra'))::date as ends_on
      from tenants t
     where t.id = p_tenant_id
  ), revenue as (
    select
      je.id as entry_id,
      case when bp.id is not null then 'room_payment'::text else 'booking_charge'::text end as source,
      coalesce(bp.method::text, bc.payment_method::text, 'unspecified') as method,
      (jl.credit - jl.debit)::bigint as amount
      from journal_entries je
      join journal_lines jl
        on jl.entry_id = je.id and jl.tenant_id = je.tenant_id
      join chart_of_accounts coa
        on coa.id = jl.account_id and coa.tenant_id = je.tenant_id
      left join booking_payments bp
        on bp.id = je.source_id and bp.tenant_id = je.tenant_id
      left join booking_charges bc
        on bc.id = je.source_id and bc.tenant_id = je.tenant_id
      cross join bounds x
     where je.tenant_id = p_tenant_id
       and je.voided_at is null
       and coa.type = 'revenue'
       and (bp.id is not null or bc.id is not null)
       and je.entry_date >= x.starts_on
       and je.entry_date < x.ends_on
  )
  select
    r.source,
    r.method,
    coalesce(sum(r.amount), 0)::bigint,
    count(distinct r.entry_id)::bigint
  from revenue r
  group by r.source, r.method
  order by r.source, r.method;
$$;

revoke all on function get_booking_revenue_breakdown(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function get_booking_revenue_breakdown(uuid, timestamptz, timestamptz)
  to service_role;

create or replace function get_booking_revenue_report(
  p_tenant_id uuid,
  p_from date,
  p_to date,
  p_group_by text
)
returns table (label text, transaction_count bigint, total_amount bigint)
language sql
stable
security definer
set search_path = public
as $$
  with revenue as (
    select
      je.id as entry_id,
      je.entry_date as occurred_on,
      coalesce(bp.method::text, bc.payment_method::text, 'Unknown') as method,
      (jl.credit - jl.debit)::bigint as amount,
      coalesce(rc.name, 'Unknown') as room_category
      from journal_entries je
      join journal_lines jl
        on jl.entry_id = je.id and jl.tenant_id = je.tenant_id
      join chart_of_accounts coa
        on coa.id = jl.account_id and coa.tenant_id = je.tenant_id
      left join booking_payments bp
        on bp.id = je.source_id and bp.tenant_id = je.tenant_id
      left join booking_charges bc
        on bc.id = je.source_id and bc.tenant_id = je.tenant_id
      left join bookings b
        on b.id = coalesce(bp.booking_id, bc.booking_id) and b.tenant_id = je.tenant_id
      left join rooms room on room.id = b.room_id and room.tenant_id = b.tenant_id
      left join room_categories rc
        on rc.id = room.category_id and rc.tenant_id = room.tenant_id
     where je.tenant_id = p_tenant_id
       and je.voided_at is null
       and coa.type = 'revenue'
       and (bp.id is not null or bc.id is not null)
       and je.entry_date between p_from and p_to
  ), labelled as (
    select case p_group_by
      when 'day' then to_char(r.occurred_on, 'YYYY-MM-DD')
      when 'week' then 'Week of ' || to_char(date_trunc('week', r.occurred_on), 'YYYY-MM-DD')
      when 'month' then to_char(r.occurred_on, 'Mon YYYY')
      when 'payment_method' then coalesce(r.method, 'Unknown')
      when 'room_category' then r.room_category
      else to_char(r.occurred_on, 'YYYY-MM-DD')
    end as label,
    case p_group_by
      when 'day' then to_char(r.occurred_on, 'YYYY-MM-DD')
      when 'week' then to_char(date_trunc('week', r.occurred_on), 'YYYY-MM-DD')
      when 'month' then to_char(date_trunc('month', r.occurred_on), 'YYYY-MM-DD')
      when 'payment_method' then coalesce(r.method, 'Unknown')
      when 'room_category' then r.room_category
      else to_char(r.occurred_on, 'YYYY-MM-DD')
    end as sort_key,
    r.entry_id,
    r.amount
    from revenue r
  )
  select l.label, count(distinct l.entry_id)::bigint, sum(l.amount)::bigint
    from labelled l
   group by l.label
   order by min(l.sort_key);
$$;

revoke all on function get_booking_revenue_report(uuid, date, date, text)
  from public, anon, authenticated;
grant execute on function get_booking_revenue_report(uuid, date, date, text)
  to service_role;

create or replace function get_platform_booking_revenue_total(p_tenant_id uuid default null)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(jl.credit - jl.debit), 0)::bigint
    from journal_entries je
    join journal_lines jl
      on jl.entry_id = je.id and jl.tenant_id = je.tenant_id
    join chart_of_accounts coa
      on coa.id = jl.account_id and coa.tenant_id = je.tenant_id
    left join booking_payments bp
      on bp.id = je.source_id and bp.tenant_id = je.tenant_id
    left join booking_charges bc
      on bc.id = je.source_id and bc.tenant_id = je.tenant_id
   where je.voided_at is null
     and coa.type = 'revenue'
     and (bp.id is not null or bc.id is not null)
     and (p_tenant_id is null or je.tenant_id = p_tenant_id);
$$;

revoke all on function get_platform_booking_revenue_total(uuid)
  from public, anon, authenticated;
grant execute on function get_platform_booking_revenue_total(uuid) to service_role;

-- A staff drawer contains more than revenue receipts. Refundable security
-- deposits increase cash when collected and reduce it when refunded, while
-- forfeitures have no further cash movement. Keep those movements separate
-- from revenue but include them in the staff member's physical close-out.
create or replace function get_staff_shift_financials(
  p_tenant_id uuid,
  p_staff_id  uuid,
  p_shift_date date
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      p_shift_date::timestamp at time zone coalesce(t.timezone, 'Africa/Accra') as starts_at,
      (p_shift_date + 1)::timestamp at time zone coalesce(t.timezone, 'Africa/Accra') as ends_at
      from tenants t
     where t.id = p_tenant_id
  ), movements as (
    select bp.method::text as method, bp.amount::bigint as amount, 'booking_receipt'::text as kind
      from booking_payments bp cross join bounds x
     where bp.tenant_id = p_tenant_id
       and bp.received_by = p_staff_id
       and bp.status = 'success'
       and bp.paid_at >= x.starts_at and bp.paid_at < x.ends_at

    union all

    select coalesce(bc.payment_method::text, 'unspecified'), bc.amount::bigint, 'folio_receipt'
      from booking_charges bc cross join bounds x
     where bc.tenant_id = p_tenant_id
       and bc.created_by = p_staff_id
       and bc.paid
       and bc.updated_at >= x.starts_at and bc.updated_at < x.ends_at

    union all

    select dd.method, dd.amount::bigint, 'deposit_collected'
      from damage_deposits dd cross join bounds x
     where dd.tenant_id = p_tenant_id
       and dd.collected_by = p_staff_id
       and dd.collected_at >= x.starts_at and dd.collected_at < x.ends_at

    union all

    select dd.method, -dd.refund_amount::bigint, 'deposit_refunded'
      from damage_deposits dd cross join bounds x
     where dd.tenant_id = p_tenant_id
       and dd.resolved_by = p_staff_id
       and dd.status in ('refunded', 'partial_refund')
       and coalesce(dd.refund_amount, 0) > 0
       and dd.resolved_at >= x.starts_at and dd.resolved_at < x.ends_at
  )
  select jsonb_build_object(
    'system_cash', coalesce(sum(amount) filter (where method = 'cash'), 0),
    'system_digital', coalesce(sum(amount) filter (where method <> 'cash'), 0),
    'cash_activity_count', count(*) filter (where method = 'cash'),
    'transaction_count', count(*),
    'booking_receipts', coalesce(sum(amount) filter (
      where kind in ('booking_receipt', 'folio_receipt')
    ), 0),
    'deposits_collected', coalesce(sum(amount) filter (where kind = 'deposit_collected'), 0),
    'deposits_refunded', coalesce(-sum(amount) filter (where kind = 'deposit_refunded'), 0)
  )
  from movements;
$$;

revoke all on function get_staff_shift_financials(uuid, uuid, date)
  from public, anon, authenticated;
grant execute on function get_staff_shift_financials(uuid, uuid, date)
  to service_role;

-- Server-side outstanding totals and detail rows keep the reports complete
-- after PostgREST's default result cap is reached.
create or replace function get_booking_outstanding_total(
  p_tenant_id uuid,
  p_from date default null,
  p_to date default null
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(bf.outstanding), 0)::bigint
    from booking_financials bf
   where bf.tenant_id = p_tenant_id
     and bf.booking_status not in ('enquiry', 'cancelled')
     and (p_from is null or bf.check_in_date >= p_from)
     and (p_to is null or bf.check_in_date <= p_to);
$$;

revoke all on function get_booking_outstanding_total(uuid, date, date)
  from public, anon, authenticated;
grant execute on function get_booking_outstanding_total(uuid, date, date)
  to service_role;

create or replace function get_booking_aging_rows(
  p_tenant_id uuid,
  p_booking_id uuid default null,
  p_occupant_id uuid default null
)
returns table (
  id uuid,
  booking_ref text,
  booking_status text,
  check_in_date date,
  check_out_date date,
  invoice_total bigint,
  invoice_received bigint,
  outstanding bigint,
  occupant_id uuid,
  first_name text,
  last_name text,
  other_names text,
  phone text,
  email text,
  student_id text,
  room_number text,
  block text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id,
    b.booking_ref,
    b.status::text,
    b.check_in_date,
    b.check_out_date,
    bf.invoice_total,
    bf.invoice_received,
    bf.outstanding,
    o.id,
    o.first_name,
    o.last_name,
    o.other_names,
    o.phone,
    o.email,
    o.student_id,
    r.room_number,
    r.block
  from booking_financials bf
  join bookings b on b.id = bf.booking_id and b.tenant_id = bf.tenant_id
  left join occupants o on o.id = b.occupant_id and o.tenant_id = b.tenant_id
  left join rooms r on r.id = b.room_id and r.tenant_id = b.tenant_id
  where bf.tenant_id = p_tenant_id
    and bf.booking_status not in ('enquiry', 'cancelled')
    and bf.outstanding > 0
    and (p_booking_id is null or b.id = p_booking_id)
    and (p_occupant_id is null or b.occupant_id = p_occupant_id)
  order by b.check_in_date, b.id;
$$;

revoke all on function get_booking_aging_rows(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function get_booking_aging_rows(uuid, uuid, uuid) to service_role;

-- Operational diagnostic used in tests and support checks. A non-zero value
-- means a subledger/ledger invariant was bypassed by legacy data or a future
-- code path and should be investigated before figures are published.
create or replace function get_financial_integrity_summary(p_tenant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with payment_journal_gaps as (
    select count(*)::bigint as count
      from booking_payments bp
     where bp.tenant_id = p_tenant_id
       and bp.status = 'success'
       and not exists (
         select 1 from journal_entries je
          where je.tenant_id = bp.tenant_id
            and je.source = 'booking_payment'
            and je.source_id = bp.id
       )
  ), charge_journal_gaps as (
    select count(*)::bigint as count
      from booking_charges bc
     where bc.tenant_id = p_tenant_id
       and bc.paid
       and not exists (
         select 1 from journal_entries je
          where je.tenant_id = bc.tenant_id
            and je.source = 'booking_charge'
            and je.source_id = bc.id
       )
  ), deposit_journal_gaps as (
    select count(*)::bigint as count
      from damage_deposits dd
     where dd.tenant_id = p_tenant_id
       and not exists (
         select 1 from journal_entries je
          where je.tenant_id = dd.tenant_id
            and je.source = 'damage_deposit'
            and je.source_id = dd.id
            and je.description = 'Damage deposit collected'
       )
  ), unbalanced_journals as (
    select count(*)::bigint as count
      from (
        select je.id
          from journal_entries je
          left join journal_lines jl
            on jl.entry_id = je.id and jl.tenant_id = je.tenant_id
         where je.tenant_id = p_tenant_id
         group by je.id
        having coalesce(sum(jl.debit), 0) <> coalesce(sum(jl.credit), 0)
            or count(jl.id) = 0
      ) x
  ), cross_tenant_journal_lines as (
    select count(*)::bigint as count
      from journal_lines jl
      join journal_entries je on je.id = jl.entry_id
      join chart_of_accounts coa on coa.id = jl.account_id
     where jl.tenant_id = p_tenant_id
       and (je.tenant_id <> jl.tenant_id or coa.tenant_id <> jl.tenant_id)
  ), booking_balance_mismatches as (
    select count(*)::bigint as count
      from bookings b
      left join lateral (
        select coalesce(sum(bp.amount) filter (where bp.status = 'success'), 0)::bigint as received
          from booking_payments bp
         where bp.booking_id = b.id and bp.tenant_id = b.tenant_id
      ) p on true
     where b.tenant_id = p_tenant_id
       and b.paid_amount is distinct from p.received
  ), cancelled_revenue_exposure as (
    select abs(coalesce(sum(jl.credit - jl.debit), 0))::bigint as amount
      from journal_entries je
      join journal_lines jl on jl.entry_id = je.id and jl.tenant_id = je.tenant_id
      join chart_of_accounts coa on coa.id = jl.account_id and coa.tenant_id = je.tenant_id
      left join booking_payments bp
        on je.source = 'booking_payment' and bp.id = je.source_id and bp.tenant_id = je.tenant_id
      left join booking_charges bc
        on je.source = 'booking_charge' and bc.id = je.source_id and bc.tenant_id = je.tenant_id
      join bookings booking
        on booking.id = coalesce(bp.booking_id, bc.booking_id)
       and booking.tenant_id = je.tenant_id
     where je.tenant_id = p_tenant_id
       and je.voided_at is null
       and booking.status = 'cancelled'
       and coa.type = 'revenue'
  ), deposit_liability_mismatches as (
    select count(*)::bigint as count
      from damage_deposits dd
      left join lateral (
        select coalesce(sum(jl.credit - jl.debit), 0)::bigint as liability
          from journal_entries je
          join journal_lines jl on jl.entry_id = je.id and jl.tenant_id = je.tenant_id
          join chart_of_accounts coa on coa.id = jl.account_id and coa.tenant_id = je.tenant_id
         where je.tenant_id = dd.tenant_id
           and je.source = 'damage_deposit'
           and je.source_id = dd.id
           and je.voided_at is null
           and coa.code = '2300'
      ) posted on true
     where dd.tenant_id = p_tenant_id
       and posted.liability is distinct from case when dd.status = 'held' then dd.amount else 0 end
  )
  select jsonb_build_object(
    'payment_journal_gaps', p.count,
    'charge_journal_gaps', c.count,
    'deposit_journal_gaps', d.count,
    'unbalanced_journals', j.count,
    'cross_tenant_journal_lines', x.count,
    'booking_balance_mismatches', b.count,
    'cancelled_revenue_exposure', e.amount,
    'deposit_liability_mismatches', dl.count,
    'total_issues', p.count + c.count + d.count + j.count + x.count + b.count + dl.count
      + case when e.amount <> 0 then 1 else 0 end
  )
  from payment_journal_gaps p
  cross join charge_journal_gaps c
  cross join deposit_journal_gaps d
  cross join unbalanced_journals j
  cross join cross_tenant_journal_lines x
  cross join booking_balance_mismatches b
  cross join cancelled_revenue_exposure e
  cross join deposit_liability_mismatches dl;
$$;

revoke all on function get_financial_integrity_summary(uuid)
  from public, anon, authenticated;
grant execute on function get_financial_integrity_summary(uuid) to service_role;

-- Provider callbacks and webhooks can arrive concurrently. Record the
-- receipt, refresh the denormalised booking balance, confirm a fully paid
-- hold, and create any late-payment resolution case in one locked
-- transaction. A matching Paystack reference is idempotent; a conflicting
-- reuse is rejected because it is evidence of a provider/data mismatch.
create or replace function finalize_online_booking_payment(
  p_tenant_id uuid,
  p_booking_id uuid,
  p_amount integer,
  p_reference text,
  p_method text default 'card',
  p_notes text default 'Paid online via Paystack'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
  v_existing booking_payments%rowtype;
  v_payment booking_payments%rowtype;
  v_reference text := nullif(btrim(p_reference), '');
begin
  if p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero'
      using errcode = '22023';
  end if;
  if v_reference is null then
    raise exception 'Payment reference is required'
      using errcode = '22023';
  end if;

  select *
    into v_booking
    from bookings
   where id = p_booking_id
     and tenant_id = p_tenant_id
   for update;

  if not found then
    return jsonb_build_object('recorded', false, 'reason', 'booking_not_found');
  end if;

  select *
    into v_existing
    from booking_payments
   where paystack_reference = v_reference;

  if found then
    if v_existing.tenant_id = p_tenant_id
       and v_existing.booking_id = p_booking_id
       and v_existing.amount = p_amount
       and v_existing.status = 'success' then
      return jsonb_build_object(
        'recorded', false,
        'payment_id', v_existing.id,
        'requires_resolution', v_booking.status = 'cancelled'
      );
    end if;

    raise exception 'Payment reference % is already attached to a different transaction',
      v_reference
      using errcode = '23505';
  end if;

  insert into booking_payments (
    tenant_id, booking_id, amount, method, paystack_reference,
    status, paid_at, notes
  ) values (
    p_tenant_id, p_booking_id, p_amount, p_method::payment_method, v_reference,
    'success', clock_timestamp(), coalesce(nullif(btrim(p_notes), ''), 'Paid online via Paystack')
  )
  returning * into v_payment;

  -- The booking-payment trigger has now refreshed paid_amount/payment_status.
  select * into v_booking from bookings where id = p_booking_id;

  if v_booking.status = 'cancelled' then
    insert into booking_payment_exceptions (
      tenant_id, booking_id, paystack_reference, exception_type,
      status, amount, details
    ) values (
      p_tenant_id, p_booking_id, v_reference,
      'late_payment_after_cancellation', 'open', p_amount,
      jsonb_build_object(
        'booking_status', v_booking.status,
        'note', 'Payment succeeded after the booking had already been cancelled'
      )
    )
    on conflict (tenant_id, paystack_reference, exception_type)
    do update set
      amount = excluded.amount,
      details = excluded.details;

    insert into audit_log (
      tenant_id, action, entity_type, entity_id, description, new_values
    ) values (
      p_tenant_id,
      'payment.requires_resolution',
      'booking',
      p_booking_id,
      'Late payment received for cancelled booking (' || v_reference || ')',
      jsonb_build_object(
        'amount', p_amount,
        'paystack_reference', v_reference,
        'resolution', 'refund_or_capacity_checked_restore'
      )
    );

    return jsonb_build_object(
      'recorded', true,
      'payment_id', v_payment.id,
      'requires_resolution', true
    );
  end if;

  if v_booking.status = 'pending_payment'
     and v_booking.paid_amount >= v_booking.final_amount then
    update bookings
       set status = 'confirmed'
     where id = v_booking.id;
  end if;

  return jsonb_build_object(
    'recorded', true,
    'payment_id', v_payment.id,
    'requires_resolution', false
  );
end;
$$;

revoke all on function finalize_online_booking_payment(uuid, uuid, integer, text, text, text)
  from public, anon, authenticated;
grant execute on function finalize_online_booking_payment(uuid, uuid, integer, text, text, text)
  to service_role;

-- MoMo/OTP flows create a pending row before contacting the provider. Settle
-- that existing row under the same booking lock and with the same late-
-- cancellation and auto-confirm semantics as hosted-checkout callbacks.
create or replace function finalize_pending_booking_payment(
  p_tenant_id uuid,
  p_payment_id uuid,
  p_provider_reference text default null,
  p_paid_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
  v_payment booking_payments%rowtype;
  v_reference text;
begin
  select *
    into v_payment
    from booking_payments
   where id = p_payment_id
     and tenant_id = p_tenant_id
   for update;

  if not found then
    return jsonb_build_object('recorded', false, 'reason', 'payment_not_found');
  end if;

  select *
    into v_booking
    from bookings
   where id = v_payment.booking_id
     and tenant_id = p_tenant_id
   for update;

  if not found then
    raise exception 'Payment booking not found' using errcode = 'P0002';
  end if;

  if v_payment.status = 'success' then
    return jsonb_build_object(
      'recorded', false,
      'payment_id', v_payment.id,
      'booking_id', v_payment.booking_id,
      'tenant_id', v_payment.tenant_id,
      'amount', v_payment.amount,
      'requires_resolution', v_booking.status = 'cancelled'
    );
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'Only a pending payment can be finalized (current status: %)',
      v_payment.status
      using errcode = '23514';
  end if;

  v_reference := coalesce(
    nullif(btrim(p_provider_reference), ''),
    nullif(btrim(v_payment.paystack_reference), ''),
    nullif(btrim(v_payment.reference), ''),
    v_payment.id::text
  );

  update booking_payments
     set status = 'success',
         paid_at = coalesce(p_paid_at, clock_timestamp()),
         reference = coalesce(nullif(btrim(p_provider_reference), ''), reference)
   where id = v_payment.id
  returning * into v_payment;

  -- The payment trigger refreshed the booking balance.
  select * into v_booking from bookings where id = v_payment.booking_id;

  if v_booking.status = 'cancelled' then
    insert into booking_payment_exceptions (
      tenant_id, booking_id, paystack_reference, exception_type,
      status, amount, details
    ) values (
      p_tenant_id, v_booking.id, v_reference,
      'late_payment_after_cancellation', 'open', v_payment.amount,
      jsonb_build_object(
        'booking_status', v_booking.status,
        'payment_id', v_payment.id,
        'note', 'Pending provider payment succeeded after the booking was cancelled'
      )
    )
    on conflict (tenant_id, paystack_reference, exception_type)
    do update set
      amount = excluded.amount,
      details = excluded.details;

    insert into audit_log (
      tenant_id, action, entity_type, entity_id, description, new_values
    ) values (
      p_tenant_id,
      'payment.requires_resolution',
      'booking',
      v_booking.id,
      'Late payment received for cancelled booking (' || v_reference || ')',
      jsonb_build_object(
        'amount', v_payment.amount,
        'payment_id', v_payment.id,
        'paystack_reference', v_reference,
        'resolution', 'refund_or_capacity_checked_restore'
      )
    );
  elsif v_booking.status = 'pending_payment'
        and v_booking.paid_amount >= v_booking.final_amount then
    update bookings set status = 'confirmed' where id = v_booking.id;
  end if;

  return jsonb_build_object(
    'recorded', true,
    'payment_id', v_payment.id,
    'booking_id', v_payment.booking_id,
    'tenant_id', v_payment.tenant_id,
    'amount', v_payment.amount,
    'requires_resolution', v_booking.status = 'cancelled'
  );
end;
$$;

revoke all on function finalize_pending_booking_payment(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function finalize_pending_booking_payment(uuid, uuid, text, timestamptz)
  to service_role;

-- Direct-method cash flow across both till cash (1010) and bank/mobile-money
-- cash (1020). Group in PostgreSQL so high-volume ledgers remain complete.
create or replace function get_cash_flow_by_source(
  p_tenant_id uuid,
  p_date_from date,
  p_date_to   date
)
returns table (
  source        text,
  total_inflow  bigint,
  total_outflow bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    je.source::text,
    coalesce(sum(jl.debit), 0)::bigint as total_inflow,
    coalesce(sum(jl.credit), 0)::bigint as total_outflow
  from journal_entries je
  join journal_lines jl
    on jl.entry_id = je.id and jl.tenant_id = je.tenant_id
  join chart_of_accounts coa
    on coa.id = jl.account_id and coa.tenant_id = je.tenant_id
  where je.tenant_id = p_tenant_id
    and je.voided_at is null
    and je.entry_date between p_date_from and p_date_to
    and coa.code in ('1010', '1020')
  group by je.source
  order by je.source;
$$;

revoke all on function get_cash_flow_by_source(uuid, date, date)
  from public, anon, authenticated;
grant execute on function get_cash_flow_by_source(uuid, date, date)
  to service_role;

-- Keep the operational daily report compatible with its existing wide table,
-- but correct its financial portion after the legacy operational counters are
-- computed. `revenue_rooms` now means recognized booking/folio revenue. Refundable damage
-- deposits remain visible in `revenue_deposits` but are not counted as revenue.
-- Some production databases received the compatibility copy during an
-- earlier manual rollout even though migration 145 was not recorded. Avoid
-- renaming over that existing function when the migration is replayed.
do $$
begin
  if to_regprocedure(
       'public.compute_daily_report_before_financial_reconciliation(uuid,date)'
     ) is null then
    alter function compute_daily_report(uuid, date)
      rename to compute_daily_report_before_financial_reconciliation;
  end if;
end;
$$;

revoke all on function compute_daily_report_before_financial_reconciliation(uuid, date)
  from public, anon, authenticated, service_role;

create or replace function compute_daily_report(
  p_tenant_id uuid,
  p_date      date default current_date
)
returns tenant_daily_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result            tenant_daily_reports;
  v_tz                text;
  v_day_start         timestamptz;
  v_day_end           timestamptz;
  v_booking_receipts  bigint := 0;
  v_charge_cash       bigint := 0;
  v_charge_momo       bigint := 0;
  v_charge_card       bigint := 0;
  v_charge_bank       bigint := 0;
  v_charge_other      bigint := 0;
  v_outstanding       bigint := 0;
begin
  select coalesce(timezone, 'Africa/Accra')
    into v_tz
    from tenants
   where id = p_tenant_id;

  if v_tz is null then
    raise exception 'Tenant % not found', p_tenant_id;
  end if;

  v_day_start := p_date::timestamp at time zone v_tz;
  v_day_end   := (p_date + 1)::timestamp at time zone v_tz;

  v_result := compute_daily_report_before_financial_reconciliation(p_tenant_id, p_date);

  select
    coalesce(sum(total_amount), 0),
    coalesce(sum(total_amount) filter (
      where source = 'booking_charge' and method = 'cash'
    ), 0),
    coalesce(sum(total_amount) filter (
      where source = 'booking_charge'
        and method in ('momo_mtn', 'momo_vodafone', 'momo_airteltigo')
    ), 0),
    coalesce(sum(total_amount) filter (
      where source = 'booking_charge' and method = 'card'
    ), 0),
    coalesce(sum(total_amount) filter (
      where source = 'booking_charge' and method in ('bank_transfer', 'bank_draft')
    ), 0),
    coalesce(sum(total_amount) filter (
      where source = 'booking_charge'
        and method not in (
          'cash', 'momo_mtn', 'momo_vodafone', 'momo_airteltigo',
          'card', 'bank_transfer', 'bank_draft'
        )
    ), 0)
  into
    v_booking_receipts,
    v_charge_cash,
    v_charge_momo,
    v_charge_card,
    v_charge_bank,
    v_charge_other
  from get_booking_revenue_breakdown(p_tenant_id, v_day_start, v_day_end);

  select coalesce(sum(bf.outstanding), 0)
    into v_outstanding
    from booking_financials bf
   where bf.tenant_id = p_tenant_id
     and bf.booking_status in ('pending_confirmation', 'pending_payment', 'confirmed', 'checked_in');

  update tenant_daily_reports
     set revenue_rooms      = v_booking_receipts,
         revenue_total      = v_booking_receipts
                              + v_result.revenue_food
                              + v_result.revenue_pos
                              + v_result.revenue_walkin,
         rev_cash           = v_result.rev_cash + v_charge_cash,
         rev_momo           = v_result.rev_momo + v_charge_momo,
         rev_card           = v_result.rev_card + v_charge_card,
         rev_bank           = v_result.rev_bank + v_charge_bank,
         rev_online_other   = v_result.rev_online_other + v_charge_other,
         outstanding_balance = v_outstanding
   where tenant_id = p_tenant_id
     and report_date = p_date
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function compute_daily_report(uuid, date)
  from public, anon, authenticated;
grant execute on function compute_daily_report(uuid, date)
  to service_role;
