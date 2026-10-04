-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 144 — Canonical booking finance and ledger reconciliation
--
-- All booking money now has one auditable route:
--   bill       = booking final amount + folio charges
--   receipts   = successful booking payments + paid folio charges
--   outstanding= unpaid base balance + unpaid folio charges
--
-- It also repairs legacy "paid_amount only" records, makes payment journals
-- idempotent, and posts proper reversing entries when money is reversed.
-- ═══════════════════════════════════════════════════════════════════════════

alter table payment_plan_installments
  add column if not exists booking_payment_id uuid
    references booking_payments(id) on delete set null;

create unique index if not exists payment_plan_installments_booking_payment_uidx
  on payment_plan_installments (booking_payment_id)
  where booking_payment_id is not null;

-- Reversals are append-only. The original entry remains in the ledger and a
-- second, linked entry swaps every debit/credit, preserving the audit trail.
create or replace function post_journal_reversal(
  p_entry_id uuid,
  p_entry_date date,
  p_description text,
  p_source_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original journal_entries%rowtype;
  v_reversal_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_entry_id::text, 0));

  select * into v_original
    from journal_entries
   where id = p_entry_id;

  if not found then
    return null;
  end if;

  select id into v_reversal_id
    from journal_entries
   where reverses_entry_id = p_entry_id
   limit 1;

  if v_reversal_id is not null then
    return v_reversal_id;
  end if;

  insert into journal_entries (
    tenant_id, entry_date, reference, description, source, source_id,
    reverses_entry_id
  ) values (
    v_original.tenant_id,
    coalesce(p_entry_date, current_date),
    v_original.reference,
    p_description,
    'refund',
    p_source_id,
    p_entry_id
  )
  returning id into v_reversal_id;

  insert into journal_lines (
    entry_id, tenant_id, account_id, description, debit, credit
  )
  select
    v_reversal_id,
    tenant_id,
    account_id,
    coalesce(description, 'Reversal'),
    credit,
    debit
  from journal_lines
  where entry_id = p_entry_id;

  return v_reversal_id;
end;
$$;

revoke all on function post_journal_reversal(uuid, date, text, uuid)
  from public, anon, authenticated;

-- Successful booking payments are cash-basis room revenue. Cash uses 1010;
-- bank, card and mobile-money methods use 1020. Reversing a payment now also
-- reverses the ledger entry instead of leaving cash/revenue overstated.
create or replace function journal_booking_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid;
  v_cash_id uuid;
  v_revenue_id uuid;
  v_booking_ref text;
  v_booking_status text;
  v_original record;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.id::text, 1));

  if tg_op = 'UPDATE'
     and old.status = 'success'
     and new.status = 'reversed' then
    for v_original in
      select id
        from journal_entries
       where tenant_id = new.tenant_id
         and source = 'booking_payment'
         and source_id = new.id
    loop
      perform post_journal_reversal(
        v_original.id,
        current_date,
        'Payment reversed',
        new.id
      );
    end loop;
    return new;
  end if;

  if new.status <> 'success'
     or (tg_op = 'UPDATE' and old.status = 'success') then
    return new;
  end if;

  if exists (
    select 1 from journal_entries
     where tenant_id = new.tenant_id
       and source = 'booking_payment'
       and source_id = new.id
  ) then
    return new;
  end if;

  select id into v_cash_id
    from chart_of_accounts
   where tenant_id = new.tenant_id
     and code = payment_method_to_cash_code(new.method::text)
   limit 1;

  select booking_ref, status::text
    into v_booking_ref, v_booking_status
    from bookings
   where id = new.booking_id and tenant_id = new.tenant_id;

  select id into v_revenue_id
    from chart_of_accounts
   where tenant_id = new.tenant_id
     and code = case when v_booking_status = 'cancelled' then '2300' else '4010' end
   limit 1;

  if v_cash_id is null or v_revenue_id is null then
    raise exception 'Required cash/revenue account is missing for tenant %', new.tenant_id
      using errcode = '23514';
  end if;

  insert into journal_entries (
    tenant_id, entry_date, reference, description, source, source_id
  ) values (
    new.tenant_id,
    coalesce(new.paid_at::date, current_date),
    coalesce(new.reference, v_booking_ref, new.id::text),
    case
      when v_booking_status = 'cancelled' then 'Late payment held for resolution'
      else 'Room payment received'
    end,
    'booking_payment',
    new.id
  )
  returning id into v_entry_id;

  insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
  values
    (v_entry_id, new.tenant_id, v_cash_id, new.amount, 0),
    (v_entry_id, new.tenant_id, v_revenue_id, 0, new.amount);

  return new;
end;
$$;

drop trigger if exists booking_payment_journal on booking_payments;
create trigger booking_payment_journal
  after insert or update of status on booking_payments
  for each row execute function journal_booking_payment();

-- A posted payment is immutable financial evidence. Corrections happen by
-- reversing it; changing its amount/method/booking in place would rewrite
-- both the subledger and general ledger history.
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

drop trigger if exists protect_posted_booking_payment on booking_payments;
create trigger protect_posted_booking_payment
  before update or delete on booking_payments
  for each row execute function protect_posted_booking_payment();

-- Paid folio items are real cash/revenue too. Previously they appeared in
-- staff revenue but nowhere in accounting, invoices summaries or reports.
create or replace function journal_booking_charge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid;
  v_cash_id uuid;
  v_revenue_id uuid;
  v_revenue_code text;
  v_booking_ref text;
  v_original record;
begin
  if tg_op = 'DELETE' then
    perform pg_advisory_xact_lock(hashtextextended(old.id::text, 2));
    if not old.paid then
      return old;
    end if;

    for v_original in
      select id
        from journal_entries
       where tenant_id = old.tenant_id
         and source = 'booking_charge'
         and source_id = old.id
    loop
      perform post_journal_reversal(
        v_original.id,
        current_date,
        'Folio charge payment reversed',
        old.id
      );
    end loop;
    return old;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.id::text, 2));

  if tg_op = 'UPDATE' and old.paid and not new.paid then
    for v_original in
      select id
        from journal_entries
       where tenant_id = old.tenant_id
         and source = 'booking_charge'
         and source_id = old.id
    loop
      perform post_journal_reversal(
        v_original.id,
        current_date,
        'Folio charge payment reversed',
        old.id
      );
    end loop;
    return new;
  end if;

  if not new.paid
     or (tg_op = 'UPDATE' and old.paid) then
    return new;
  end if;

  if exists (
    select 1 from journal_entries
     where tenant_id = new.tenant_id
       and source = 'booking_charge'
       and source_id = new.id
  ) then
    return new;
  end if;

  v_revenue_code := case new.category
    when 'laundry'       then '4020'
    when 'food_beverage' then '4050'
    when 'room_service'  then '4050'
    when 'minibar'       then '4050'
    when 'parking'       then '4070'
    else                      '4030'
  end;

  select id into v_cash_id
    from chart_of_accounts
   where tenant_id = new.tenant_id
     and code = payment_method_to_cash_code(new.payment_method::text)
   limit 1;

  select id into v_revenue_id
    from chart_of_accounts
   where tenant_id = new.tenant_id and code = v_revenue_code
   limit 1;

  if v_revenue_id is null then
    select id into v_revenue_id
      from chart_of_accounts
     where tenant_id = new.tenant_id and code = '4030'
     limit 1;
  end if;

  if v_cash_id is null or v_revenue_id is null then
    raise exception 'Required cash/revenue account is missing for tenant %', new.tenant_id
      using errcode = '23514';
  end if;

  select booking_ref into v_booking_ref
    from bookings
   where id = new.booking_id and tenant_id = new.tenant_id;

  insert into journal_entries (
    tenant_id, entry_date, reference, description, source, source_id
  ) values (
    new.tenant_id,
    coalesce(new.updated_at, new.created_at)::date,
    coalesce(v_booking_ref, new.id::text),
    'Folio charge — ' || new.description,
    'booking_charge',
    new.id
  )
  returning id into v_entry_id;

  insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
  values
    (v_entry_id, new.tenant_id, v_cash_id, new.amount, 0),
    (v_entry_id, new.tenant_id, v_revenue_id, 0, new.amount);

  return new;
end;
$$;

drop trigger if exists booking_charge_journal on booking_charges;
create trigger booking_charge_journal
  after insert or update of paid or delete on booking_charges
  for each row execute function journal_booking_charge();

-- Legacy paid charges did not require a method. Preserve them as cash—the
-- form's historical default—then require provenance for every paid charge.
update booking_charges
   set payment_method = 'cash'
 where paid and payment_method is null;

alter table booking_charges
  drop constraint if exists booking_charges_paid_method_check;
alter table booking_charges
  add constraint booking_charges_paid_method_check
  check (not paid or payment_method is not null);

create or replace function protect_posted_booking_charge()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.paid and tg_op = 'UPDATE' and (
    new.amount is distinct from old.amount
    or new.category is distinct from old.category
    or new.payment_method is distinct from old.payment_method
    or new.booking_id is distinct from old.booking_id
    or new.tenant_id is distinct from old.tenant_id
  ) then
    raise exception 'A paid folio charge cannot be edited; mark it unpaid or delete it to reverse the receipt'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
     and not old.paid
     and new.paid
     and exists (
       select 1
         from journal_entries je
        where je.tenant_id = old.tenant_id
          and je.source = 'booking_charge'
          and je.source_id = old.id
     ) then
    raise exception 'A reversed folio receipt is terminal; create a replacement charge'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_posted_booking_charge on booking_charges;
create trigger protect_posted_booking_charge
  before update on booking_charges
  for each row execute function protect_posted_booking_charge();

-- Cancelling an already-paid booking does not make the cash disappear, but
-- it does make the receipt refundable/unapplied until staff explicitly
-- resolve it. Move recognized room/folio income to the 2300 liability while
-- keeping each adjustment linked to the original financial record.
create or replace function reclassify_cancelled_booking_receipts(
  p_tenant_id uuid,
  p_booking_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p booking_payments%rowtype;
  c booking_charges%rowtype;
  v_entry_id uuid;
  v_revenue_id uuid;
  v_liability_id uuid;
  v_revenue_code text;
  v_booking_ref text;
begin
  select booking_ref into v_booking_ref
    from bookings
   where id = p_booking_id
     and tenant_id = p_tenant_id
     and status = 'cancelled';

  if not found then
    return;
  end if;

  -- An unpaid cancellation has nothing financial to reclassify and should
  -- not depend on the tenant having completed accounting setup.
  if not exists (
       select 1
         from booking_payments bp
        where bp.tenant_id = p_tenant_id
          and bp.booking_id = p_booking_id
          and bp.status = 'success'
     ) and not exists (
       select 1
         from booking_charges bc
        where bc.tenant_id = p_tenant_id
          and bc.booking_id = p_booking_id
          and bc.paid
     ) then
    return;
  end if;

  select id into v_liability_id
    from chart_of_accounts
   where tenant_id = p_tenant_id and code = '2300'
   limit 1;

  if v_liability_id is null then
    raise exception 'Required Unearned Revenue account (2300) is not configured'
      using errcode = '23514';
  end if;

  select id into v_revenue_id
    from chart_of_accounts
   where tenant_id = p_tenant_id and code = '4010'
   limit 1;

  if v_revenue_id is null and exists (
    select 1
      from booking_payments bp
     where bp.tenant_id = p_tenant_id
       and bp.booking_id = p_booking_id
       and bp.status = 'success'
  ) then
    raise exception 'Required Accommodation Revenue account (4010) is not configured'
      using errcode = '23514';
  end if;

  for p in
      select bp.*
        from booking_payments bp
       where bp.tenant_id = p_tenant_id
         and bp.booking_id = p_booking_id
         and bp.status = 'success'
         and exists (
           select 1
             from journal_entries je
             join journal_lines jl on jl.entry_id = je.id and jl.tenant_id = je.tenant_id
            where je.tenant_id = bp.tenant_id
              and je.source = 'booking_payment'
              and je.source_id = bp.id
              and jl.account_id = v_revenue_id
              and jl.credit > 0
         )
         and not exists (
           select 1 from journal_entries je
            where je.tenant_id = bp.tenant_id
              and je.source = 'booking_payment'
              and je.source_id = bp.id
              and je.description = 'Cancelled booking receipt reclassified for resolution'
         )
  loop
      insert into journal_entries (
        tenant_id, entry_date, reference, description, source, source_id
      ) values (
        p.tenant_id, current_date,
        coalesce(v_booking_ref, p.id::text),
        'Cancelled booking receipt reclassified for resolution',
        'booking_payment', p.id
      ) returning id into v_entry_id;

      insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
      values
        (v_entry_id, p.tenant_id, v_revenue_id, p.amount, 0),
        (v_entry_id, p.tenant_id, v_liability_id, 0, p.amount);
  end loop;

  for c in
    select bc.*
      from booking_charges bc
     where bc.tenant_id = p_tenant_id
       and bc.booking_id = p_booking_id
       and bc.paid
       and not exists (
         select 1 from journal_entries je
          where je.tenant_id = bc.tenant_id
            and je.source = 'booking_charge'
            and je.source_id = bc.id
            and je.description = 'Cancelled booking folio receipt reclassified for resolution'
       )
  loop
    v_revenue_code := case c.category
      when 'laundry'       then '4020'
      when 'food_beverage' then '4050'
      when 'room_service'  then '4050'
      when 'minibar'       then '4050'
      when 'parking'       then '4070'
      else                      '4030'
    end;

    select id into v_revenue_id
      from chart_of_accounts
     where tenant_id = c.tenant_id and code = v_revenue_code
     limit 1;
    if v_revenue_id is null then
      select id into v_revenue_id
        from chart_of_accounts
       where tenant_id = c.tenant_id and code = '4030'
       limit 1;
    end if;

    if v_revenue_id is null then
      raise exception 'Required folio revenue account (% or 4030) is not configured',
        v_revenue_code
        using errcode = '23514';
    end if;

    if exists (
      select 1
        from journal_entries je
        join journal_lines jl on jl.entry_id = je.id and jl.tenant_id = je.tenant_id
       where je.tenant_id = c.tenant_id
         and je.source = 'booking_charge'
         and je.source_id = c.id
         and jl.account_id = v_revenue_id
         and jl.credit > 0
    ) then
      insert into journal_entries (
        tenant_id, entry_date, reference, description, source, source_id
      ) values (
        c.tenant_id, current_date,
        coalesce(v_booking_ref, c.id::text),
        'Cancelled booking folio receipt reclassified for resolution',
        'booking_charge', c.id
      ) returning id into v_entry_id;

      insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
      values
        (v_entry_id, c.tenant_id, v_revenue_id, c.amount, 0),
        (v_entry_id, c.tenant_id, v_liability_id, 0, c.amount);
    end if;
  end loop;
end;
$$;

revoke all on function reclassify_cancelled_booking_receipts(uuid, uuid)
  from public, anon, authenticated;

create or replace function trg_reclassify_cancelled_booking_receipts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    perform reclassify_cancelled_booking_receipts(new.tenant_id, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists reclassify_cancelled_booking_receipts on bookings;
create trigger reclassify_cancelled_booking_receipts
  after update of status on bookings
  for each row execute function trg_reclassify_cancelled_booking_receipts();

-- Damage/security deposits are liabilities while held, not revenue. Collection
-- debits cash and credits 2300; resolution returns cash and/or recognizes only
-- the forfeited portion as other income.
alter table damage_deposits
  add column if not exists resolved_by uuid references auth.users(id) on delete set null;

alter table damage_deposits
  drop constraint if exists damage_deposits_resolution_amount_check;
alter table damage_deposits
  add constraint damage_deposits_resolution_amount_check check (
    refund_amount is null or refund_amount between 0 and amount
  );

create or replace function journal_damage_deposit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid;
  v_cash_id uuid;
  v_liability_id uuid;
  v_income_id uuid;
  v_refund integer;
  v_forfeited integer;
  v_original record;
begin
  if tg_op = 'DELETE' then
    perform pg_advisory_xact_lock(hashtextextended(old.id::text, 3));
    for v_original in
      select id from journal_entries
       where tenant_id = old.tenant_id
         and source = 'damage_deposit'
         and source_id = old.id
    loop
      perform post_journal_reversal(
        v_original.id, current_date, 'Damage deposit record removed', old.id
      );
    end loop;
    return old;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.id::text, 3));

  select id into v_cash_id
    from chart_of_accounts
   where tenant_id = new.tenant_id
     and code = payment_method_to_cash_code(new.method)
   limit 1;
  select id into v_liability_id
    from chart_of_accounts
   where tenant_id = new.tenant_id and code = '2300'
   limit 1;

  if v_cash_id is null or v_liability_id is null then
    raise exception 'Required cash/deposit-liability account is missing for tenant %', new.tenant_id
      using errcode = '23514';
  end if;

  if not exists (
    select 1 from journal_entries
     where tenant_id = new.tenant_id
       and source = 'damage_deposit'
       and source_id = new.id
       and description = 'Damage deposit collected'
  ) then
    insert into journal_entries (
      tenant_id, entry_date, reference, description, source, source_id
    ) values (
      new.tenant_id, new.collected_at::date,
      coalesce(new.reference, new.id::text),
      'Damage deposit collected', 'damage_deposit', new.id
    ) returning id into v_entry_id;

    insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
    values
      (v_entry_id, new.tenant_id, v_cash_id, new.amount, 0),
      (v_entry_id, new.tenant_id, v_liability_id, 0, new.amount);
  end if;

  if new.status = 'held' or exists (
    select 1 from journal_entries
     where tenant_id = new.tenant_id
       and source = 'damage_deposit'
       and source_id = new.id
       and description like 'Damage deposit resolved — %'
  ) then
    return new;
  end if;

  v_refund := case new.status
    when 'refunded' then new.amount
    when 'partial_refund' then coalesce(new.refund_amount, 0)
    else 0
  end;
  v_forfeited := new.amount - v_refund;

  if v_forfeited > 0 then
    select id into v_income_id
      from chart_of_accounts
     where tenant_id = new.tenant_id and code = '4030'
     limit 1;
    if v_income_id is null then
      raise exception 'Other Income account (4030) is required to forfeit a damage deposit'
        using errcode = '23514';
    end if;
  end if;

  insert into journal_entries (
    tenant_id, entry_date, reference, description, source, source_id
  ) values (
    new.tenant_id, coalesce(new.resolved_at::date, current_date),
    coalesce(new.reference, new.id::text),
    'Damage deposit resolved — ' || new.status,
    'damage_deposit', new.id
  ) returning id into v_entry_id;

  insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
  values (v_entry_id, new.tenant_id, v_liability_id, new.amount, 0);

  if v_refund > 0 then
    insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
    values (v_entry_id, new.tenant_id, v_cash_id, 0, v_refund);
  end if;

  if v_forfeited > 0 then
    insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
    values (v_entry_id, new.tenant_id, v_income_id, 0, v_forfeited);
  end if;

  return new;
end;
$$;

create or replace function protect_damage_deposit_evidence()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'held' then
      raise exception 'A resolved damage deposit cannot be deleted'
        using errcode = '23514';
    end if;
    return old;
  end if;

  if new.amount is distinct from old.amount
     or new.method is distinct from old.method
     or new.reference is distinct from old.reference
     or new.collected_by is distinct from old.collected_by
     or new.tenant_id is distinct from old.tenant_id
     or new.booking_id is distinct from old.booking_id
     or new.occupant_id is distinct from old.occupant_id
     or new.collected_at is distinct from old.collected_at then
    raise exception 'A posted damage deposit cannot be edited; resolve or remove it'
      using errcode = '23514';
  end if;

  if old.status <> 'held' and (
    new.status is distinct from old.status
    or new.refund_amount is distinct from old.refund_amount
    or new.refund_reason is distinct from old.refund_reason
    or new.resolved_at is distinct from old.resolved_at
    or new.resolved_by is distinct from old.resolved_by
  ) then
    raise exception 'A resolved damage deposit is terminal'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_damage_deposit_evidence on damage_deposits;
create trigger protect_damage_deposit_evidence
  before update or delete on damage_deposits
  for each row execute function protect_damage_deposit_evidence();

drop trigger if exists damage_deposit_journal on damage_deposits;
create trigger damage_deposit_journal
  after insert or update of status or delete on damage_deposits
  for each row execute function journal_damage_deposit();

-- Fire the idempotent posting function for existing held/resolved deposits.
update damage_deposits set status = status;

-- Enforce coherent resolution evidence for all new changes without blocking
-- deployment on an old malformed row; the backfill above has already posted
-- every row using the safest interpretation available.
alter table damage_deposits
  drop constraint if exists damage_deposits_resolution_state_check;
alter table damage_deposits
  add constraint damage_deposits_resolution_state_check check (
    (status = 'held' and resolved_at is null)
    or (
      status = 'refunded'
      and resolved_at is not null
      and refund_amount = amount
    )
    or (
      status = 'forfeited'
      and resolved_at is not null
      and refund_amount = 0
    )
    or (
      status = 'partial_refund'
      and resolved_at is not null
      and refund_amount is not null
      and refund_amount between 0 and amount
    )
  ) not valid;

-- Every journal mutation must leave its entry balanced at transaction end.
-- The trigger is deferred so normal two-line postings can be inserted in
-- separate statements inside the same transaction.
create or replace function enforce_journal_line_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
      from journal_entries je
      join chart_of_accounts coa on coa.id = new.account_id
     where je.id = new.entry_id
       and je.tenant_id = new.tenant_id
       and coa.tenant_id = new.tenant_id
  ) then
    raise exception 'Journal line entry, account and tenant must belong to the same tenant'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_journal_line_tenant on journal_lines;
create trigger enforce_journal_line_tenant
  before insert or update on journal_lines
  for each row execute function enforce_journal_line_tenant();

create or replace function enforce_balanced_journal_entry()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_entry_id uuid := coalesce(new.entry_id, old.entry_id);
  v_debit bigint;
  v_credit bigint;
begin
  if not exists (select 1 from journal_entries where id = v_entry_id) then
    return coalesce(new, old);
  end if;

  select coalesce(sum(debit), 0), coalesce(sum(credit), 0)
    into v_debit, v_credit
    from journal_lines
   where entry_id = v_entry_id;

  if v_debit <> v_credit then
    raise exception 'Journal entry % is not balanced (debits %, credits %)',
      v_entry_id, v_debit, v_credit
      using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists enforce_balanced_journal_entry on journal_lines;
create constraint trigger enforce_balanced_journal_entry
  after insert or update or delete on journal_lines
  deferrable initially deferred
  for each row execute function enforce_balanced_journal_entry();

-- Canonical read model used by invoices, reports and accounting receivables.
create or replace view booking_financials
with (security_invoker = true)
as
select
  b.id as booking_id,
  b.tenant_id,
  b.status as booking_status,
  b.check_in_date,
  b.final_amount as base_amount,
  coalesce(p.received, 0)::bigint as room_payments_received,
  coalesce(c.total, 0)::bigint as charges_amount,
  coalesce(c.received, 0)::bigint as charges_received,
  (b.final_amount + coalesce(c.total, 0))::bigint as invoice_total,
  (least(coalesce(p.received, 0), b.final_amount) + coalesce(c.received, 0))::bigint
    as invoice_received,
  (greatest(b.final_amount - coalesce(p.received, 0), 0)
    + coalesce(c.total, 0) - coalesce(c.received, 0))::bigint as outstanding,
  greatest(coalesce(p.received, 0) - b.final_amount, 0)::bigint as customer_credit,
  case
    when greatest(b.final_amount - coalesce(p.received, 0), 0)
       + coalesce(c.total, 0) - coalesce(c.received, 0) = 0 then 'paid'
    when coalesce(p.received, 0) + coalesce(c.received, 0) = 0 then 'unpaid'
    else 'partial'
  end as derived_payment_status
from bookings b
left join lateral (
  select coalesce(sum(bp.amount), 0)::bigint as received
    from booking_payments bp
   where bp.booking_id = b.id and bp.status = 'success'
) p on true
left join lateral (
  select
    coalesce(sum(bc.amount), 0)::bigint as total,
    coalesce(sum(bc.amount) filter (where bc.paid), 0)::bigint as received
    from booking_charges bc
   where bc.booking_id = b.id
) c on true;

revoke all on booking_financials from public, anon, authenticated;
grant select on booking_financials to service_role;

create or replace function get_booking_financial_summary(p_tenant_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with billable as (
    select *
      from booking_financials
     where tenant_id = p_tenant_id
       and booking_status not in ('enquiry', 'cancelled')
  ), payment_totals as (
    select
      coalesce(sum(bp.amount) filter (where bp.status = 'success'), 0)::bigint as successful,
      count(*) filter (where bp.status = 'success')::int as successful_count,
      coalesce(sum(bp.amount) filter (where bp.status = 'pending'), 0)::bigint as pending,
      count(*) filter (where bp.status = 'pending')::int as pending_count,
      coalesce(sum(bp.amount) filter (where bp.status = 'reversed'), 0)::bigint as reversed,
      count(*) filter (where bp.status = 'reversed')::int as reversed_count,
      coalesce(sum(bp.amount) filter (
        where bp.status = 'success'
          and bp.paid_at >= date_trunc('month', current_timestamp)
      ), 0)::bigint as room_mtd,
      coalesce(sum(bp.amount) filter (
        where bp.status = 'success'
          and bp.paid_at >= date_trunc('year', current_timestamp)
      ), 0)::bigint as room_ytd
    from booking_payments bp
    join bookings b on b.id = bp.booking_id and b.tenant_id = bp.tenant_id
    where bp.tenant_id = p_tenant_id
  ), charge_totals as (
    select
      coalesce(sum(bc.amount) filter (where bc.paid), 0)::bigint as received,
      count(*) filter (where bc.paid)::int as received_count,
      coalesce(sum(bc.amount) filter (
        where bc.paid and bc.updated_at >= date_trunc('month', current_timestamp)
      ), 0)::bigint as charge_mtd,
      coalesce(sum(bc.amount) filter (
        where bc.paid and bc.updated_at >= date_trunc('year', current_timestamp)
      ), 0)::bigint as charge_ytd
    from booking_charges bc
    join bookings b on b.id = bc.booking_id and b.tenant_id = bc.tenant_id
    where bc.tenant_id = p_tenant_id
  ), recognized_totals as (
    select
      coalesce(sum(jl.credit - jl.debit) filter (
        where je.entry_date >= date_trunc('month', current_date)::date
      ), 0)::bigint as mtd,
      coalesce(sum(jl.credit - jl.debit) filter (
        where je.entry_date >= date_trunc('year', current_date)::date
      ), 0)::bigint as ytd
    from journal_entries je
    join journal_lines jl
      on jl.entry_id = je.id and jl.tenant_id = je.tenant_id
    join chart_of_accounts coa
      on coa.id = jl.account_id and coa.tenant_id = je.tenant_id
    left join booking_payments bp
      on bp.id = je.source_id and bp.tenant_id = je.tenant_id
    left join booking_charges bc
      on bc.id = je.source_id and bc.tenant_id = je.tenant_id
    where je.tenant_id = p_tenant_id
      and je.voided_at is null
      and coa.type = 'revenue'
      and (bp.id is not null or bc.id is not null)
  ), charge_reversal_totals as (
    select
      coalesce(sum(jl.debit), 0)::bigint as reversed,
      count(distinct je.id)::int as reversed_count
    from journal_entries je
    join journal_lines jl on jl.entry_id = je.id and jl.tenant_id = je.tenant_id
    join chart_of_accounts coa on coa.id = jl.account_id and coa.tenant_id = je.tenant_id
    where je.tenant_id = p_tenant_id
      and je.source = 'booking_charge'
      and je.description like 'Folio charge — %'
      and coa.code in ('1010', '1020')
      and jl.debit > 0
      and exists (
        select 1 from journal_entries reversal
         where reversal.reverses_entry_id = je.id
      )
  )
  select jsonb_build_object(
    'invoice_count', (select count(*) from billable),
    'total_invoiced', coalesce((select sum(invoice_total) from billable), 0),
    'invoice_received', coalesce((select sum(invoice_received) from billable), 0),
    'outstanding', coalesce((select sum(outstanding) from billable), 0),
    'overdue_outstanding', coalesce((
      select sum(outstanding)
        from billable
       where booking_status in ('confirmed', 'checked_in')
         and check_in_date < current_date
         and outstanding > 0
    ), 0),
    'overdue_count', (
      select count(*)
        from billable
       where booking_status in ('confirmed', 'checked_in')
         and check_in_date < current_date
         and outstanding > 0
    ),
    'customer_credit', coalesce((select sum(customer_credit) from billable), 0),
    'unapplied_receipts', greatest(
      payment_totals.successful + charge_totals.received
      - coalesce((select sum(invoice_received) from billable), 0),
      0
    ),
    'room_payments_received', payment_totals.successful,
    'room_payment_count', payment_totals.successful_count,
    'pending_payments', payment_totals.pending,
    'pending_payment_count', payment_totals.pending_count,
    'reversed_payments', payment_totals.reversed,
    'reversed_payment_count', payment_totals.reversed_count,
    'reversed_charges', charge_reversal_totals.reversed,
    'reversed_charge_count', charge_reversal_totals.reversed_count,
    'total_reversed', payment_totals.reversed + charge_reversal_totals.reversed,
    'charge_payments_received', charge_totals.received,
    'charge_payment_count', charge_totals.received_count,
    'total_receipts', payment_totals.successful + charge_totals.received,
    'mtd_received', payment_totals.room_mtd + charge_totals.charge_mtd,
    'ytd_received', payment_totals.room_ytd + charge_totals.charge_ytd,
    'mtd_recognized', recognized_totals.mtd,
    'ytd_recognized', recognized_totals.ytd
  )
  from payment_totals
  cross join charge_totals
  cross join recognized_totals
  cross join charge_reversal_totals;
$$;

revoke all on function get_booking_financial_summary(uuid)
  from public, anon, authenticated;
grant execute on function get_booking_financial_summary(uuid) to service_role;

-- Aggregate in Postgres so accounting never silently truncates at the REST
-- API row cap (a trial balance built from the first 1,000 lines is invalid).
create or replace function get_trial_balance(
  p_tenant_id uuid,
  p_date_from date default null,
  p_date_to date default null
)
returns table (
  account_id uuid,
  code text,
  name text,
  type account_type,
  total_debit bigint,
  total_credit bigint,
  balance bigint
)
language sql
security definer
set search_path = public
as $$
  select
    coa.id,
    coa.code,
    coa.name,
    coa.type,
    coalesce(sum(jl.debit), 0)::bigint,
    coalesce(sum(jl.credit), 0)::bigint,
    case
      when coa.type in ('asset', 'expense')
        then (coalesce(sum(jl.debit), 0) - coalesce(sum(jl.credit), 0))::bigint
      else (coalesce(sum(jl.credit), 0) - coalesce(sum(jl.debit), 0))::bigint
    end
  from chart_of_accounts coa
  join journal_lines jl
    on jl.account_id = coa.id and jl.tenant_id = coa.tenant_id
  join journal_entries je
    on je.id = jl.entry_id and je.tenant_id = coa.tenant_id
  where coa.tenant_id = p_tenant_id
    and je.voided_at is null
    and (p_date_from is null or je.entry_date >= p_date_from)
    and (p_date_to is null or je.entry_date <= p_date_to)
  group by coa.id, coa.code, coa.name, coa.type
  order by coa.code;
$$;

revoke all on function get_trial_balance(uuid, date, date)
  from public, anon, authenticated;
grant execute on function get_trial_balance(uuid, date, date) to service_role;

create or replace function get_monthly_financial_trend(
  p_tenant_id uuid,
  p_date_from date,
  p_date_to date
)
returns table (month date, revenue bigint, expenses bigint)
language sql
security definer
set search_path = public
as $$
  select
    date_trunc('month', je.entry_date)::date as month,
    coalesce(sum(jl.credit - jl.debit) filter (where coa.type = 'revenue'), 0)::bigint,
    coalesce(sum(jl.debit - jl.credit) filter (where coa.type = 'expense'), 0)::bigint
  from journal_entries je
  join journal_lines jl on jl.entry_id = je.id and jl.tenant_id = je.tenant_id
  join chart_of_accounts coa on coa.id = jl.account_id and coa.tenant_id = je.tenant_id
  where je.tenant_id = p_tenant_id
    and je.voided_at is null
    and je.entry_date between p_date_from and p_date_to
  group by date_trunc('month', je.entry_date)
  order by month;
$$;

revoke all on function get_monthly_financial_trend(uuid, date, date)
  from public, anon, authenticated;
grant execute on function get_monthly_financial_trend(uuid, date, date) to service_role;

-- Atomic entry point for every staff/manual receipt. The booking lock makes
-- overpayment validation and insertion a single transaction.
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
declare
  v_booking bookings%rowtype;
  v_received bigint;
  v_remaining bigint;
  v_payment booking_payments%rowtype;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero' using errcode = '22023';
  end if;

  perform (p_method::payment_method);

  select * into v_booking
    from bookings
   where id = p_booking_id and tenant_id = p_tenant_id
   for update;

  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if v_booking.status = 'cancelled' then
    raise exception 'Cannot record a payment on a cancelled booking' using errcode = '23514';
  end if;

  select coalesce(sum(amount), 0) into v_received
    from booking_payments
   where booking_id = v_booking.id and status = 'success';

  if not p_allow_duplicate and exists (
    select 1
      from booking_payments bp
     where bp.booking_id = v_booking.id
       and bp.status = 'success'
       and bp.amount = p_amount
       and bp.method = p_method::payment_method
       and bp.paid_at >= now() - interval '3 minutes'
  ) then
    raise exception 'A matching payment was recorded within the last 3 minutes'
      using errcode = '23505';
  end if;

  v_remaining := greatest(v_booking.final_amount - v_received, 0);

  if not p_allow_overpayment and p_amount > v_remaining then
    raise exception 'Payment exceeds the outstanding balance (% > %)', p_amount, v_remaining
      using errcode = '22003';
  end if;

  insert into booking_payments (
    tenant_id, booking_id, amount, method, reference, notes,
    status, paid_at, received_by
  ) values (
    p_tenant_id, v_booking.id, p_amount, p_method::payment_method,
    nullif(btrim(p_reference), ''), nullif(btrim(p_notes), ''),
    'success', now(), p_actor_id
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
    'balance', greatest(v_booking.final_amount - v_received - p_amount, 0)
  );
end;
$$;

revoke all on function record_booking_payment(uuid, uuid, integer, text, text, text, uuid, boolean, boolean)
  from public, anon, authenticated;
grant execute on function record_booking_payment(uuid, uuid, integer, text, text, text, uuid, boolean, boolean)
  to service_role;

create or replace function settle_payment_plan_installment(
  p_tenant_id uuid,
  p_installment_id uuid,
  p_method text,
  p_reference text default null,
  p_actor_id uuid default null,
  p_paid_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_installment payment_plan_installments%rowtype;
  v_booking_id uuid;
  v_result jsonb;
begin
  select i.*
    into v_installment
    from payment_plan_installments i
    join payment_plans p on p.id = i.plan_id and p.tenant_id = i.tenant_id
   where i.id = p_installment_id and i.tenant_id = p_tenant_id
   for update of i;

  if not found then
    raise exception 'Installment not found' using errcode = 'P0002';
  end if;

  select booking_id into v_booking_id
    from payment_plans
   where id = v_installment.plan_id and tenant_id = p_tenant_id;

  if v_installment.status = 'paid' and v_installment.booking_payment_id is not null then
    return jsonb_build_object(
      'changed', false,
      'installment_id', v_installment.id,
      'payment_id', v_installment.booking_payment_id
    );
  end if;

  v_result := record_booking_payment(
    p_tenant_id,
    v_booking_id,
    v_installment.amount::integer,
    p_method,
    p_reference,
    'Payment plan installment #' || v_installment.installment_number,
    p_actor_id,
    false,
    true
  );

  update payment_plan_installments
     set status = 'paid',
         paid_at = p_paid_at,
         payment_method = p_method,
         reference = nullif(btrim(p_reference), ''),
         booking_payment_id = (v_result ->> 'id')::uuid
   where id = v_installment.id;

  return v_result || jsonb_build_object(
    'changed', true,
    'installment_id', v_installment.id
  );
end;
$$;

revoke all on function settle_payment_plan_installment(uuid, uuid, text, text, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function settle_payment_plan_installment(uuid, uuid, text, text, uuid, timestamptz)
  to service_role;

-- Snapshot pre-migration balances before inserting transaction evidence.
create temporary table legacy_booking_balances on commit drop as
select id, tenant_id, paid_amount::bigint as paid_amount
from bookings;

-- Convert paid installments that were previously balance-only updates into
-- real payment rows. A reference match is reused where one already exists.
do $$
declare
  i record;
  v_payment_id uuid;
begin
  for i in
    select pi.*, pp.booking_id
      from payment_plan_installments pi
      join payment_plans pp on pp.id = pi.plan_id
     where pi.status = 'paid' and pi.booking_payment_id is null
  loop
    v_payment_id := null;

    if nullif(btrim(i.reference), '') is not null then
      select id into v_payment_id
        from booking_payments
       where booking_id = i.booking_id
         and status = 'success'
         and reference = i.reference
       order by created_at
       limit 1;
    end if;

    if v_payment_id is null then
      insert into booking_payments (
        tenant_id, booking_id, amount, method, reference, status, paid_at, notes
      ) values (
        i.tenant_id,
        i.booking_id,
        i.amount::integer,
        coalesce(nullif(i.payment_method, ''), 'cash')::payment_method,
        nullif(btrim(i.reference), ''),
        'success',
        coalesce(i.paid_at, i.created_at),
        'Migrated payment plan installment #' || i.installment_number
      )
      returning id into v_payment_id;
    end if;

    update payment_plan_installments
       set booking_payment_id = v_payment_id
     where id = i.id;
  end loop;
end;
$$;

-- Preserve other legacy paid balances (notably the former bulk Mark paid
-- shortcut) by materialising only the unexplained gap as a transaction.
insert into booking_payments (
  tenant_id, booking_id, amount, method, reference, status, paid_at, notes
)
select
  l.tenant_id,
  l.id,
  (l.paid_amount - coalesce(p.received, 0))::integer,
  'cash'::payment_method,
  'LEGACY-' || left(l.id::text, 8),
  'success',
  now(),
  'Migrated from a legacy paid balance that had no payment transaction'
from legacy_booking_balances l
left join lateral (
  select coalesce(sum(amount), 0)::bigint as received
    from booking_payments bp
   where bp.booking_id = l.id and bp.status = 'success'
) p on true
where l.paid_amount > coalesce(p.received, 0);

-- Repair any stale denormalised booking balances in either direction.
update bookings b
   set paid_amount = p.received,
       payment_status = case
         when p.received = 0 then 'unpaid'::payment_status
         when p.received >= b.final_amount then 'paid'::payment_status
         else 'partial'::payment_status
       end
from (
  select b2.id, coalesce(sum(bp.amount) filter (where bp.status = 'success'), 0)::bigint as received
    from bookings b2
    left join booking_payments bp on bp.booking_id = b2.id
   group by b2.id
) p
where b.id = p.id
  and (b.paid_amount is distinct from p.received
       or b.payment_status is distinct from case
         when p.received = 0 then 'unpaid'::payment_status
         when p.received >= b.final_amount then 'paid'::payment_status
         else 'partial'::payment_status
       end);

-- Backfill missing payment and charge journals with the corrected posting
-- rules. Trigger functions cannot be invoked directly, so these loops write
-- the same two-line entries explicitly.
do $$
declare
  p booking_payments%rowtype;
  c booking_charges%rowtype;
  e record;
  v_entry_id uuid;
  v_cash_id uuid;
  v_revenue_id uuid;
  v_revenue_code text;
  v_booking_ref text;
  v_booking_status text;
begin
  for p in
    select bp.*
      from booking_payments bp
     where bp.status = 'success'
       and not exists (
         select 1 from journal_entries je
          where je.tenant_id = bp.tenant_id
            and je.source = 'booking_payment'
            and je.source_id = bp.id
       )
  loop
    select id into v_cash_id from chart_of_accounts
     where tenant_id = p.tenant_id
       and code = payment_method_to_cash_code(p.method::text)
     limit 1;
    select booking_ref, status::text
      into v_booking_ref, v_booking_status
      from bookings where id = p.booking_id;
    select id into v_revenue_id from chart_of_accounts
     where tenant_id = p.tenant_id
       and code = case when v_booking_status = 'cancelled' then '2300' else '4010' end
     limit 1;

    if v_cash_id is not null and v_revenue_id is not null then
      insert into journal_entries (
        tenant_id, entry_date, reference, description, source, source_id
      ) values (
        p.tenant_id, coalesce(p.paid_at::date, current_date),
        coalesce(p.reference, v_booking_ref, p.id::text),
        case
          when v_booking_status = 'cancelled' then 'Late payment held for resolution'
          else 'Room payment received'
        end,
        'booking_payment', p.id
      ) returning id into v_entry_id;

      insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
      values
        (v_entry_id, p.tenant_id, v_cash_id, p.amount, 0),
        (v_entry_id, p.tenant_id, v_revenue_id, 0, p.amount);
    end if;
  end loop;

  for c in
    select bc.*
      from booking_charges bc
     where bc.paid
       and not exists (
         select 1 from journal_entries je
          where je.tenant_id = bc.tenant_id
            and je.source = 'booking_charge'
            and je.source_id = bc.id
       )
  loop
    v_revenue_code := case c.category
      when 'laundry'       then '4020'
      when 'food_beverage' then '4050'
      when 'room_service'  then '4050'
      when 'minibar'       then '4050'
      when 'parking'       then '4070'
      else                      '4030'
    end;
    select id into v_cash_id from chart_of_accounts
     where tenant_id = c.tenant_id
       and code = payment_method_to_cash_code(c.payment_method::text)
     limit 1;
    select id into v_revenue_id from chart_of_accounts
     where tenant_id = c.tenant_id and code = v_revenue_code limit 1;
    if v_revenue_id is null then
      select id into v_revenue_id from chart_of_accounts
       where tenant_id = c.tenant_id and code = '4030' limit 1;
    end if;
    select booking_ref into v_booking_ref from bookings where id = c.booking_id;

    if v_cash_id is not null and v_revenue_id is not null then
      insert into journal_entries (
        tenant_id, entry_date, reference, description, source, source_id
      ) values (
        c.tenant_id, coalesce(c.updated_at, c.created_at)::date,
        coalesce(v_booking_ref, c.id::text),
        'Folio charge — ' || c.description, 'booking_charge', c.id
      ) returning id into v_entry_id;

      insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
      values
        (v_entry_id, c.tenant_id, v_cash_id, c.amount, 0),
        (v_entry_id, c.tenant_id, v_revenue_id, 0, c.amount);
    end if;
  end loop;

  -- Neutralise duplicate legacy payment journals while retaining every
  -- original entry for audit. Future writes are serialized and idempotent.
  for e in
    select id, source_id
      from (
        select je.id, je.source_id,
               row_number() over (
                 partition by je.tenant_id, je.source, je.source_id
                 order by je.created_at, je.id
               ) as rn
          from journal_entries je
         where je.source = 'booking_payment' and je.source_id is not null
      ) d
     where d.rn > 1
  loop
    perform post_journal_reversal(
      e.id, current_date, 'Duplicate payment journal correction', e.source_id
    );
  end loop;

  -- Payments received against bookings that are now cancelled are refundable
  -- or await an explicit restoration decision. Reclassify previously posted
  -- room revenue to Unearned Revenue; the payment reversal workflow will
  -- reverse both linked entries if staff refund the receipt later.
  for e in
    select bp.id as payment_id, bp.tenant_id, bp.amount, bp.paid_at,
           b.booking_ref
      from booking_payments bp
      join bookings b on b.id = bp.booking_id and b.tenant_id = bp.tenant_id
     where bp.status = 'success'
       and b.status = 'cancelled'
       and exists (
         select 1
           from journal_entries je
           join journal_lines jl on jl.entry_id = je.id and jl.tenant_id = je.tenant_id
           join chart_of_accounts coa on coa.id = jl.account_id and coa.tenant_id = je.tenant_id
          where je.tenant_id = bp.tenant_id
            and je.source = 'booking_payment'
            and je.source_id = bp.id
            and coa.code = '4010'
            and jl.credit > 0
       )
  loop
    select id into v_cash_id from chart_of_accounts
     where tenant_id = e.tenant_id and code = '4010' limit 1;
    select id into v_revenue_id from chart_of_accounts
     where tenant_id = e.tenant_id and code = '2300' limit 1;

    if v_cash_id is not null and v_revenue_id is not null then
      insert into journal_entries (
        tenant_id, entry_date, reference, description, source, source_id
      ) values (
        e.tenant_id, current_date,
        coalesce(e.booking_ref, e.payment_id::text),
        'Cancelled booking receipt reclassified for resolution',
        'booking_payment', e.payment_id
      ) returning id into v_entry_id;

      insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
      values
        (v_entry_id, e.tenant_id, v_cash_id, e.amount, 0),
        (v_entry_id, e.tenant_id, v_revenue_id, 0, e.amount);
    end if;
  end loop;

  -- The helper also handles paid folio charges and skips room receipts already
  -- reclassified by the historical repair immediately above.
  for e in
    select id as booking_id, tenant_id
      from bookings
     where status = 'cancelled'
  loop
    perform reclassify_cancelled_booking_receipts(e.tenant_id, e.booking_id);
  end loop;

  -- Any payment already marked reversed before this migration must also be
  -- neutral in the general ledger.
  for e in
    select je.id, bp.id as payment_id
      from booking_payments bp
      join journal_entries je
        on je.tenant_id = bp.tenant_id
       and je.source = 'booking_payment'
       and je.source_id = bp.id
     where bp.status = 'reversed'
       and not exists (
         select 1 from journal_entries r where r.reverses_entry_id = je.id
       )
  loop
    perform post_journal_reversal(
      e.id, current_date, 'Payment reversed (historical repair)', e.payment_id
    );
  end loop;
end;
$$;
