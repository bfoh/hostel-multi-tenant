-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 072 — Owner daily operations report
--
-- Pre-aggregated daily metrics per tenant. Powers:
--   • Owner dashboard (`/dashboard/owner`)
--   • Daily digest (SMS + email + push)
--   • Trend / week-over-week comparisons
--
-- One row per (tenant_id, report_date). Idempotently recomputed by
-- compute_daily_report(tenant_id, date).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists tenant_daily_reports (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  report_date         date not null,
  computed_at         timestamptz not null default now(),
  digest_sent_at      timestamptz,

  -- Revenue (pesewas, tenant currency = GHS)
  revenue_total       bigint not null default 0,
  revenue_rooms       bigint not null default 0,
  revenue_food        bigint not null default 0,
  revenue_pos         bigint not null default 0,
  revenue_walkin      bigint not null default 0,
  revenue_deposits    bigint not null default 0,

  -- Revenue by method
  rev_cash            bigint not null default 0,
  rev_momo            bigint not null default 0,
  rev_card            bigint not null default 0,
  rev_bank            bigint not null default 0,
  rev_online_other    bigint not null default 0,

  -- Receivables
  outstanding_balance bigint not null default 0,
  overdue_installments_count int not null default 0,
  overdue_installments_amount bigint not null default 0,

  -- Occupancy
  rooms_total         int not null default 0,
  rooms_occupied      int not null default 0,
  rooms_reserved      int not null default 0,
  rooms_dirty         int not null default 0,
  rooms_maintenance   int not null default 0,
  occupancy_pct       numeric(5,2) not null default 0,

  -- Movement
  arrivals_today      int not null default 0,
  departures_today    int not null default 0,
  no_shows_today      int not null default 0,
  walkin_count        int not null default 0,
  food_orders_count   int not null default 0,

  -- Cash control
  cash_expected       bigint not null default 0,
  cash_counted        bigint not null default 0,
  cash_variance       bigint not null default 0,
  bank_drafts_pending int not null default 0,

  -- Operations
  maintenance_open    int not null default 0,
  maintenance_resolved_today int not null default 0,
  housekeeping_pending int not null default 0,
  laundry_in_progress int not null default 0,

  -- Anomalies
  anomalies_critical  int not null default 0,
  anomalies_warning   int not null default 0,
  first_anomaly_msg   text,

  -- Outlook (forward-looking, snapshotted at compute time)
  arrivals_next_7d    int not null default 0,
  renewals_due_30d    int not null default 0,
  lease_expiry_30d    int not null default 0,

  constraint tenant_daily_reports_unique unique (tenant_id, report_date)
);

create index if not exists idx_tenant_daily_reports_recent
  on tenant_daily_reports (tenant_id, report_date desc);

alter table tenant_daily_reports enable row level security;

create policy "tenant members can view daily reports"
  on tenant_daily_reports for select
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );

-- ── Digest preferences on the tenant ────────────────────────────────────────

alter table tenants
  add column if not exists daily_digest_enabled      boolean not null default true,
  add column if not exists daily_digest_time         time   not null default '19:00',
  add column if not exists daily_digest_channels     jsonb  not null default '{"sms":true,"email":true,"push":true}'::jsonb,
  add column if not exists daily_digest_recipients   jsonb  not null default '[]'::jsonb,
  add column if not exists daily_digest_paused_until timestamptz;

comment on column tenants.daily_digest_recipients is
  'Additional recipient objects [{ name, phone, email }] beyond the primary owner.';

-- ═══════════════════════════════════════════════════════════════════════════
-- compute_daily_report(p_tenant_id, p_date) — idempotent UPSERT
-- ═══════════════════════════════════════════════════════════════════════════

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
  -- Resolve tenant timezone (defaults to Africa/Accra via schema)
  select coalesce(timezone, 'Africa/Accra') into v_tz from tenants where id = p_tenant_id;
  if v_tz is null then
    raise exception 'Tenant % not found', p_tenant_id;
  end if;

  -- Local day boundaries (timestamptz, half-open: [start, end))
  v_day_start := (p_date::timestamp at time zone v_tz);
  v_day_end   := ((p_date + interval '1 day')::timestamp at time zone v_tz);
  v_seven_days_out  := p_date + 7;
  v_thirty_days_out := p_date + 30;

  -- ── Revenue: rooms (booking_payments) ────────────────────────────────────
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

  -- ── Revenue: food orders ────────────────────────────────────────────────
  select coalesce(sum(total_pesewas), 0), count(*)
    into v_revenue_food, v_food_count
    from food_orders
   where tenant_id = p_tenant_id
     and paid_at is not null
     and paid_at >= v_day_start and paid_at < v_day_end;

  -- ── Revenue: revenue point sales (POS + walk-in) ────────────────────────
  --   Walk-in subset = sales with visitor_id (means they came through QR portal).
  --   POS = the rest.
  select coalesce(sum(case when visitor_id is null then total_amount else 0 end), 0),
         coalesce(sum(case when visitor_id is not null then total_amount else 0 end), 0),
         count(*) filter (where visitor_id is not null)
    into v_revenue_pos, v_revenue_walkin, v_walkin
    from revenue_point_sales
   where tenant_id = p_tenant_id
     and sold_at >= v_day_start and sold_at < v_day_end;

  -- Add POS payment-method breakdown to the same buckets
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

  -- ── Revenue: damage deposits collected today ────────────────────────────
  select coalesce(sum(amount), 0)
    into v_revenue_deposits
    from damage_deposits
   where tenant_id = p_tenant_id
     and collected_at >= v_day_start and collected_at < v_day_end;

  -- ── Receivables (point-in-time) ─────────────────────────────────────────
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

  -- ── Occupancy ───────────────────────────────────────────────────────────
  select count(*),
         count(*) filter (where status = 'occupied'),
         count(*) filter (where status = 'reserved'),
         count(*) filter (where status = 'dirty'),
         count(*) filter (where status = 'maintenance')
    into v_rooms_total, v_rooms_occupied, v_rooms_reserved, v_rooms_dirty, v_rooms_maint
    from rooms
   where tenant_id = p_tenant_id;

  -- ── Movement (today) ────────────────────────────────────────────────────
  select count(*) filter (where status = 'checked_in' and check_in_date = p_date),
         count(*) filter (where status = 'checked_out' and check_out_date = p_date),
         count(*) filter (where status = 'pending_payment' and check_in_date = p_date)
    into v_arrivals, v_departures, v_noshows
    from bookings
   where tenant_id = p_tenant_id
     and (check_in_date = p_date or check_out_date = p_date);

  -- ── Cash control (today's closeouts) ────────────────────────────────────
  select coalesce(sum(system_cash), 0),
         coalesce(sum(declared_cash), 0)
    into v_cash_expected, v_cash_counted
    from shift_closeouts
   where tenant_id = p_tenant_id
     and shift_date = p_date;

  select count(*) into v_bank_drafts
    from bank_draft_submissions
   where tenant_id = p_tenant_id
     and status = 'submitted';

  -- ── Operations counters ─────────────────────────────────────────────────
  select count(*) filter (where status in ('open','in_progress')),
         count(*) filter (where status = 'completed' and completed_at >= v_day_start and completed_at < v_day_end)
    into v_maint_open, v_maint_resolved
    from maintenance_requests
   where tenant_id = p_tenant_id;

  select count(*) into v_hk_pending
    from housekeeping_tasks
   where tenant_id = p_tenant_id
     and status in ('pending','in_progress');

  select count(*) into v_laundry_progress
    from revenue_point_sales
   where tenant_id = p_tenant_id
     and status in ('received','washing','ready');

  -- ── Anomalies (today) ───────────────────────────────────────────────────
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

  -- ── Outlook (forward) ───────────────────────────────────────────────────
  select count(*) into v_arr_7d
    from bookings
   where tenant_id = p_tenant_id
     and status = 'confirmed'
     and check_in_date > p_date
     and check_in_date <= v_seven_days_out;

  -- Renewals + expiries: bookings whose check_out_date is in the 30-day window.
  -- "Renewals due" approximates as confirmed/checked_in nearing their end date.
  select count(*) filter (where status in ('confirmed','checked_in')),
         count(*) filter (where status = 'checked_in')
    into v_renew_30d, v_expiry_30d
    from bookings
   where tenant_id = p_tenant_id
     and check_out_date is not null
     and check_out_date > p_date
     and check_out_date <= v_thirty_days_out;

  -- ── UPSERT report row ───────────────────────────────────────────────────
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

comment on function compute_daily_report(uuid, date) is
  'Idempotently aggregates one day''s operational metrics into tenant_daily_reports. Safe to recompute.';
