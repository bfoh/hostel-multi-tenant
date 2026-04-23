-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 051 — Fix booking_payment auto-journal trigger (status value)
--
-- Background: booking_payments.status allows ('pending','success','failed',
-- 'reversed') but the trigger checked `status = 'paid'`, which never matches.
-- Every successful payment silently skipped ledger posting, leaving
-- accounting/reports at GH₵0 even though payments existed.
--
-- Fix:
--   1. Replace the trigger logic to check `status = 'success'` instead.
--   2. Backfill journal entries for every existing successful payment.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function journal_booking_payment()
returns trigger language plpgsql as $$
declare
  v_entry_id  uuid;
  v_cash_id   uuid;
  v_rev_id    uuid;
  v_booking   record;
begin
  -- Only journal when status flips to 'success'
  if new.status <> 'success' then
    return new;
  end if;
  if old is not null and old.status = 'success' then
    return new;  -- already journaled
  end if;

  -- Resolve system accounts
  select id into v_cash_id from chart_of_accounts
    where tenant_id = new.tenant_id and code = '1020' limit 1;
  select id into v_rev_id  from chart_of_accounts
    where tenant_id = new.tenant_id and code = '4010' limit 1;

  if v_cash_id is null or v_rev_id is null then
    return new;  -- COA not seeded yet — skip
  end if;

  -- Fetch booking ref for description
  select booking_ref into v_booking from bookings where id = new.booking_id limit 1;

  -- Create journal entry header
  insert into journal_entries
    (tenant_id, entry_date, reference, description, source, source_id)
  values
    (new.tenant_id, coalesce(new.paid_at::date, current_date),
     coalesce(v_booking.booking_ref, new.id::text),
     'Room revenue — payment received',
     'booking_payment', new.id)
  returning id into v_entry_id;

  -- DR Cash at Bank
  insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
  values (v_entry_id, new.tenant_id, v_cash_id, new.amount, 0);

  -- CR Room Revenue
  insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
  values (v_entry_id, new.tenant_id, v_rev_id, 0, new.amount);

  return new;
end;
$$;

-- ── Backfill: post a JE for every successful payment missing one ───────────

do $$
declare
  p record;
begin
  for p in
    select bp.*
      from booking_payments bp
     where bp.status = 'success'
       and not exists (
         select 1 from journal_entries je
          where je.source    = 'booking_payment'
            and je.source_id = bp.id
       )
  loop
    declare
      v_entry_id    uuid;
      v_cash_id     uuid;
      v_rev_id      uuid;
      v_booking_ref text;
    begin
      select id into v_cash_id from chart_of_accounts
        where tenant_id = p.tenant_id and code = '1020' limit 1;
      select id into v_rev_id  from chart_of_accounts
        where tenant_id = p.tenant_id and code = '4010' limit 1;

      if v_cash_id is null or v_rev_id is null then
        continue;
      end if;

      select booking_ref into v_booking_ref
        from bookings where id = p.booking_id limit 1;

      insert into journal_entries
        (tenant_id, entry_date, reference, description, source, source_id)
      values
        (p.tenant_id, coalesce(p.paid_at::date, current_date),
         coalesce(v_booking_ref, p.id::text),
         'Room revenue — payment received',
         'booking_payment', p.id)
      returning id into v_entry_id;

      insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
      values (v_entry_id, p.tenant_id, v_cash_id, p.amount, 0);

      insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
      values (v_entry_id, p.tenant_id, v_rev_id, 0, p.amount);
    end;
  end loop;
end;
$$;
