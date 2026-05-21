-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 092 — Walk-in cash-on-pickup support
--
-- Lets gym / sports / laundry customers select "Pay cash at pickup"
-- when they scan the QR. The sale is inserted with status='pending_pickup'
-- so the booking is recorded, but the auto-journal trigger SKIPS posting
-- until staff flip the status to a settled state (completed/collected/
-- received/washing/ready) — at which point revenue + cash are recognised
-- exactly as for online payments.
--
-- Changes:
--   1. Extend the revenue_point_sales.status check to include
--      'pending_pickup'
--   2. Patch journal_revenue_point_sale() to skip while pending
-- ═══════════════════════════════════════════════════════════════════════════

alter table revenue_point_sales
  drop constraint if exists revenue_point_sales_status_check;
alter table revenue_point_sales
  add  constraint revenue_point_sales_status_check
  check (status in (
    'pending_pickup',
    'completed','received','washing','ready','collected','cancelled'
  ));

create or replace function journal_revenue_point_sale()
returns trigger language plpgsql as $$
declare
  v_entry_id    uuid;
  v_rev_code    text;
  v_cash_code   text;
  v_rev_acct_id uuid;
  v_cash_id     uuid;
  v_rp_type     text;
  v_desc        text;
begin
  -- On UPDATE/DELETE: drop the prior journal entry so we can re-post (or
  -- leave nothing if the sale is now pending/cancelled).
  if TG_OP in ('UPDATE', 'DELETE') then
    delete from journal_entries
     where source    = 'revenue_point'
       and source_id = old.id;
  end if;

  if TG_OP = 'DELETE' then
    return old;
  end if;

  -- Skip posting while the sale is still awaiting payment or has been
  -- cancelled. Re-posting kicks in automatically on the next UPDATE that
  -- flips status into a settled state.
  if new.status in ('pending_pickup', 'cancelled') then
    return new;
  end if;

  select type into v_rp_type
    from revenue_points
   where id = new.revenue_point_id;

  v_rev_code  := revenue_point_type_to_code(v_rp_type);
  v_cash_code := payment_method_to_cash_code(new.payment_method);
  v_desc      := coalesce(v_rp_type, 'sale') || ' — ' || new.description;

  select id into v_rev_acct_id
    from chart_of_accounts
   where tenant_id = new.tenant_id and code = v_rev_code
   limit 1;

  select id into v_cash_id
    from chart_of_accounts
   where tenant_id = new.tenant_id and code = v_cash_code
   limit 1;

  if v_rev_acct_id is null or v_cash_id is null then
    return new;
  end if;

  insert into journal_entries
    (tenant_id, entry_date, reference, description, source, source_id)
  values
    (new.tenant_id, new.sold_at::date, new.reference, v_desc,
     'revenue_point', new.id)
  returning id into v_entry_id;

  insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
  values (v_entry_id, new.tenant_id, v_cash_id, new.total_amount, 0);

  insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
  values (v_entry_id, new.tenant_id, v_rev_acct_id, 0, new.total_amount);

  return new;
end;
$$;
