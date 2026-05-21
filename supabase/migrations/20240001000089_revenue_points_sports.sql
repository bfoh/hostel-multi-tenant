-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 089 — Sports centre revenue-point type
--
-- The walk-in pricing TS already supports 'sports' (court hourly rate +
-- min minutes) and SportsFlow renders correctly, but the revenue_points
-- type check constraint and the income-routing helper haven't been
-- extended. This migration patches both.
--
-- Income routes to 4040 (recreational) shared with the gym for now; can
-- be split into its own 40xx account later if reporting needs to
-- distinguish.
-- ═══════════════════════════════════════════════════════════════════════════

alter table revenue_points drop constraint if exists revenue_points_type_check;
alter table revenue_points
  add constraint revenue_points_type_check
  check (type in (
    'gym','sports','cafeteria','restaurant','mini_mart',
    'laundry','printing','parking','other'
  ));

create or replace function revenue_point_type_to_code(p_type text)
returns text language sql immutable as $$
  select case p_type
    when 'gym'        then '4040'
    when 'sports'     then '4040'   -- shares Gym & Recreation income for now
    when 'cafeteria'  then '4050'
    when 'restaurant' then '4050'
    when 'mini_mart'  then '4060'
    when 'laundry'    then '4020'
    when 'parking'    then '4070'
    when 'printing'   then '4080'
    else                   '4030'
  end
$$;
