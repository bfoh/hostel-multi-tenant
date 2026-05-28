-- compute_daily_report referenced tables that have not been created in
-- this deployment (bank_draft_submissions, maintenance_requests). Each
-- missing table aborted the RPC with "relation … does not exist" and
-- blocked the daily digest.
--
-- Guard every aggregation on those tables with to_regclass so the
-- function still produces a report when the table is absent. The
-- counters default to 0, which is the correct neutral value for the
-- digest and dashboard.

create or replace function compute_daily_report(
  p_tenant_id uuid,
  p_date      date default current_date
) returns tenant_daily_reports
language plpgsql
security definer
as $$
declare
  v_tz                text;
  v_day_start         timestamptz;
  v_day_end           timestamptz;
  v_now               timestamptz := now();
  v_seven_days_out    date;
  v_thirty_days_out   date;
  v_revenue_rooms     bigint := 0;
  v_revenue_food      bigint := 0;
  v_revenue_pos       bigint := 0;
  v_revenue_walkin    bigint := 0;
  v_revenue_deposits  bigint := 0;
  v_rev_cash          bigint := 0;
  v_rev_momo          bigint := 0;
  v_rev_card          bigint := 0;
  v_rev_bank          bigint := 0;
  v_rev_online_other  bigint := 0;
  v_outstanding       bigint := 0;
  v_overdue_count     int := 0;
  v_overdue_amount    bigint := 0;
  v_rooms_total       int := 0;
  v_rooms_occupied    int := 0;
  v_rooms_reserved    int := 0;
  v_rooms_dirty       int := 0;
  v_rooms_maint       int := 0;
  v_arrivals          int := 0;
  v_departures        int := 0;
  v_noshows           int := 0;
  v_walkin            int := 0;
  v_food_count        int := 0;
  v_cash_expected     bigint := 0;
  v_cash_counted      bigint := 0;
  v_bank_drafts       int := 0;
  v_maint_open        int := 0;
  v_maint_resolved    int := 0;
  v_hk_pending        int := 0;
  v_laundry_progress  int := 0;
  v_anom_crit         int := 0;
  v_anom_warn         int := 0;
  v_first_anom        text;
  v_arr_7d            int := 0;
  v_renew_30d         int := 0;
  v_expiry_30d        int := 0;
  v_result            tenant_daily_reports;
begin
  select coalesce(timezone, 'Africa/Accra') into v_tz from tenants where id = p_tenant_id;
  if v_tz is null then
    raise exception 'Tenant % not found', p_tenant_id;
  end if;

  v_day_start := (p_date::timestamp at time zone v_tz);
  v_day_end   := ((p_date + interval '1 day')::timestamp at time zone v_tz);
  v_seven_days_out  := p_date + 7;
  v_thirty_days_out := p_date + 30;

  select coalesce(sum(amount), 0),
         coalesce(sum(case when method = 'cash' then amount else 0 end), 0),
         coalesce(sum(case when method in ('momo_mtn','momo_vodafone','momo_airteltigo') then amount else 0 end), 0),
         coalesce(sum(case when method = 'card' then amount else 0 end), 0),
         coalesce(sum(case when method in ('bank_transfer','bank_draft') then amount else 0 end), 0)
    into v_revenue_rooms, v_rev_cash, v_rev_momo, v_rev_card, v_rev_bank
    from booking_payments
   where tenant_id = p_tenant_id
     and status = 'success'
     and paid_at >= v_day_start and paid_at < v_day_end;

  select coalesce(sum(total_pesewas), 0), count(*)
    into v_revenue_food, v_food_count
    from food_orders
   where tenant_id = p_tenant_id
     and paid_at is not null
     and paid_at >= v_day_start and paid_at < v_day_end;

  select coalesce(sum(case when visitor_id is null then total_amount else 0 end), 0),
         coalesce(sum(case when visitor_id is not null then total_amount else 0 end), 0),
         count(*) filter (where visitor_id is not null)
    into v_revenue_pos, v_revenue_walkin, v_walkin
    from revenue_point_sales
   where tenant_id = p_tenant_id
     and sold_at >= v_day_start and sold_at < v_day_end;

  with pos as (
    select payment_method, total_amount
      from revenue_point_sales
     where tenant_id = p_tenant_id
       and sold_at >= v_day_start and sold_at < v_day_end
  )
  select v_rev_cash + coalesce(sum(case when payment_method = 'cash' then total_amount end), 0),
         v_rev_momo + coalesce(sum(case when payment_method in ('momo_mtn','momo_vodafone','momo_airteltigo') then total_amount end), 0),
         v_rev_card + coalesce(sum(case when payment_method = 'card' then total_amount end), 0),
         v_rev_bank + coalesce(sum(case when payment_method = 'bank_transfer' then total_amount end), 0),
         v_rev_online_other + coalesce(sum(case when payment_method = 'on_account' then total_amount end), 0)
    into v_rev_cash, v_rev_momo, v_rev_card, v_rev_bank, v_rev_online_other
    from pos;

  select coalesce(sum(amount), 0)
    into v_revenue_deposits
    from damage_deposits
   where tenant_id = p_tenant_id
     and collected_at >= v_day_start and collected_at < v_day_end;

  select coalesce(sum(greatest(0, final_amount - paid_amount)), 0)
    into v_outstanding
    from bookings
   where tenant_id = p_tenant_id
     and status in ('confirmed','checked_in','pending_payment');

  select count(*),
         coalesce(sum(amount), 0)
    into v_overdue_count, v_overdue_amount
    from payment_plan_installments
   where tenant_id = p_tenant_id
     and status = 'pending'
     and due_date < p_date;

  -- 'dirty' lives on housekeeping_status (see migration 0103).
  select count(*),
         count(*) filter (where status = 'occupied'),
         count(*) filter (where status = 'reserved'),
         count(*) filter (where housekeeping_status = 'dirty'),
         count(*) filter (where status = 'maintenance')
    into v_rooms_total, v_rooms_occupied, v_rooms_reserved, v_rooms_dirty, v_rooms_maint
    from rooms
   where tenant_id = p_tenant_id;

  select count(*) filter (where status = 'checked_in' and check_in_date = p_date),
         count(*) filter (where status = 'checked_out' and check_out_date = p_date),
         count(*) filter (where status = 'pending_payment' and check_in_date = p_date)
    into v_arrivals, v_departures, v_noshows
    from bookings
   where tenant_id = p_tenant_id
     and (check_in_date = p_date or check_out_date = p_date);

  select coalesce(sum(system_cash), 0),
         coalesce(sum(declared_cash), 0)
    into v_cash_expected, v_cash_counted
    from shift_closeouts
   where tenant_id = p_tenant_id
     and shift_date = p_date;

  -- Guarded: bank_draft_submissions is optional in some deployments.
  if to_regclass('public.bank_draft_submissions') is not null then
    execute $q$
      select count(*)
        from public.bank_draft_submissions
       where tenant_id = $1
         and status = 'submitted'
    $q$ into v_bank_drafts using p_tenant_id;
  end if;

  -- Guarded: maintenance_requests is not deployed everywhere yet.
  if to_regclass('public.maintenance_requests') is not null then
    execute $q$
      select count(*) filter (where status in ('open','in_progress')),
             count(*) filter (where status = 'completed' and completed_at >= $2 and completed_at < $3)
        from public.maintenance_requests
       where tenant_id = $1
    $q$ into v_maint_open, v_maint_resolved using p_tenant_id, v_day_start, v_day_end;
  end if;

  select count(*) into v_hk_pending
    from housekeeping_tasks
   where tenant_id = p_tenant_id
     and status in ('pending','in_progress');

  select count(*) into v_laundry_progress
    from revenue_point_sales
   where tenant_id = p_tenant_id
     and status in ('received','washing','ready');

  select count(*) filter (where severity = 'critical'),
         count(*) filter (where severity = 'warning')
    into v_anom_crit, v_anom_warn
    from anomaly_alerts
   where tenant_id = p_tenant_id
     and created_at >= v_day_start and created_at < v_day_end;

  select message into v_first_anom
    from anomaly_alerts
   where tenant_id = p_tenant_id
     and created_at >= v_day_start and created_at < v_day_end
     and severity = 'critical'
   order by created_at desc
   limit 1;

  select count(*) into v_arr_7d
    from bookings
   where tenant_id = p_tenant_id
     and status = 'confirmed'
     and check_in_date > p_date
     and check_in_date <= v_seven_days_out;

  select count(*) filter (where status in ('confirmed','checked_in')),
         count(*) filter (where status = 'checked_in')
    into v_renew_30d, v_expiry_30d
    from bookings
   where tenant_id = p_tenant_id
     and check_out_date is not null
     and check_out_date > p_date
     and check_out_date <= v_thirty_days_out;

  insert into tenant_daily_reports as r (
    tenant_id, report_date, computed_at,
    revenue_total, revenue_rooms, revenue_food, revenue_pos, revenue_walkin, revenue_deposits,
    rev_cash, rev_momo, rev_card, rev_bank, rev_online_other,
    outstanding_balance, overdue_installments_count, overdue_installments_amount,
    rooms_total, rooms_occupied, rooms_reserved, rooms_dirty, rooms_maintenance, occupancy_pct,
    arrivals_today, departures_today, no_shows_today, walkin_count, food_orders_count,
    cash_expected, cash_counted, cash_variance, bank_drafts_pending,
    maintenance_open, maintenance_resolved_today, housekeeping_pending, laundry_in_progress,
    anomalies_critical, anomalies_warning, first_anomaly_msg,
    arrivals_next_7d, renewals_due_30d, lease_expiry_30d
  )
  values (
    p_tenant_id, p_date, v_now,
    v_revenue_rooms + v_revenue_food + v_revenue_pos + v_revenue_walkin + v_revenue_deposits,
    v_revenue_rooms, v_revenue_food, v_revenue_pos, v_revenue_walkin, v_revenue_deposits,
    v_rev_cash, v_rev_momo, v_rev_card, v_rev_bank, v_rev_online_other,
    v_outstanding, v_overdue_count, v_overdue_amount,
    v_rooms_total, v_rooms_occupied, v_rooms_reserved, v_rooms_dirty, v_rooms_maint,
    case when v_rooms_total > 0 then round((v_rooms_occupied::numeric / v_rooms_total) * 100, 2) else 0 end,
    v_arrivals, v_departures, v_noshows, v_walkin, v_food_count,
    v_cash_expected, v_cash_counted, v_cash_counted - v_cash_expected, v_bank_drafts,
    v_maint_open, v_maint_resolved, v_hk_pending, v_laundry_progress,
    v_anom_crit, v_anom_warn, v_first_anom,
    v_arr_7d, v_renew_30d, v_expiry_30d
  )
  on conflict (tenant_id, report_date) do update set
    computed_at = excluded.computed_at,
    revenue_total = excluded.revenue_total,
    revenue_rooms = excluded.revenue_rooms,
    revenue_food = excluded.revenue_food,
    revenue_pos = excluded.revenue_pos,
    revenue_walkin = excluded.revenue_walkin,
    revenue_deposits = excluded.revenue_deposits,
    rev_cash = excluded.rev_cash,
    rev_momo = excluded.rev_momo,
    rev_card = excluded.rev_card,
    rev_bank = excluded.rev_bank,
    rev_online_other = excluded.rev_online_other,
    outstanding_balance = excluded.outstanding_balance,
    overdue_installments_count = excluded.overdue_installments_count,
    overdue_installments_amount = excluded.overdue_installments_amount,
    rooms_total = excluded.rooms_total,
    rooms_occupied = excluded.rooms_occupied,
    rooms_reserved = excluded.rooms_reserved,
    rooms_dirty = excluded.rooms_dirty,
    rooms_maintenance = excluded.rooms_maintenance,
    occupancy_pct = excluded.occupancy_pct,
    arrivals_today = excluded.arrivals_today,
    departures_today = excluded.departures_today,
    no_shows_today = excluded.no_shows_today,
    walkin_count = excluded.walkin_count,
    food_orders_count = excluded.food_orders_count,
    cash_expected = excluded.cash_expected,
    cash_counted = excluded.cash_counted,
    cash_variance = excluded.cash_variance,
    bank_drafts_pending = excluded.bank_drafts_pending,
    maintenance_open = excluded.maintenance_open,
    maintenance_resolved_today = excluded.maintenance_resolved_today,
    housekeeping_pending = excluded.housekeeping_pending,
    laundry_in_progress = excluded.laundry_in_progress,
    anomalies_critical = excluded.anomalies_critical,
    anomalies_warning = excluded.anomalies_warning,
    first_anomaly_msg = excluded.first_anomaly_msg,
    arrivals_next_7d = excluded.arrivals_next_7d,
    renewals_due_30d = excluded.renewals_due_30d,
    lease_expiry_30d = excluded.lease_expiry_30d
  returning * into v_result;

  return v_result;
end;
$$;
