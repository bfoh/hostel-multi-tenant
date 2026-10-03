-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 141 — Schedule booking hold cleanup with Supabase Cron
--
-- Vercel Hobby only permits daily cron schedules, which is too slow for the
-- 15–30 minute online booking holds. Supabase pg_cron invokes the protected
-- application endpoint every five minutes instead. Calling the application
-- endpoint (rather than mutating rows here) preserves the canonical
-- cancellation workflow, including notifications and webhooks.
--
-- Before applying this migration, create these encrypted Vault secrets:
--
--   booking_holds_sweep_url
--     https://app.abremponghostel.com/api/cron/booking-holds-sweep
--
--   booking_holds_sweep_secret
--     The same random value configured as CRON_SECRET in Vercel.
--
-- Never commit either secret value to source control.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists supabase_vault with schema vault;
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.invoke_booking_holds_sweep()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url        text;
  v_secret     text;
  v_request_id bigint;
begin
  select decrypted_secret
    into v_url
    from vault.decrypted_secrets
   where name = 'booking_holds_sweep_url';

  select decrypted_secret
    into v_secret
    from vault.decrypted_secrets
   where name = 'booking_holds_sweep_secret';

  if nullif(btrim(v_url), '') is null then
    raise exception 'Vault secret booking_holds_sweep_url is not configured';
  end if;

  if nullif(btrim(v_secret), '') is null then
    raise exception 'Vault secret booking_holds_sweep_secret is not configured';
  end if;

  select net.http_post(
    url                  := v_url,
    headers              := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body                 := jsonb_build_object(
      'scheduler', 'supabase_cron',
      'requested_at', now()
    ),
    timeout_milliseconds := 60000
  )
  into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.invoke_booking_holds_sweep()
  from public, anon, authenticated;

-- A named pg_cron job is replaced instead of duplicated if this migration is
-- deliberately replayed during recovery.
do $$
declare
  v_job_id bigint;
begin
  select jobid
    into v_job_id
    from cron.job
   where jobname = 'booking-holds-sweep-every-five-minutes';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'booking-holds-sweep-every-five-minutes',
    '*/5 * * * *',
    'select private.invoke_booking_holds_sweep();'
  );
end;
$$;
