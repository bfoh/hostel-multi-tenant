-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 148 — Deliver queued webhooks every minute with Supabase Cron
--
-- Migration 147 queues webhook events in the database; this job calls the
-- protected application endpoint that signs and sends them. Like migration
-- 141, it goes through Supabase Cron because Vercel Hobby only allows daily
-- schedules.
--
-- Before applying this migration, create these encrypted Vault secrets:
--
--   webhook_deliveries_url
--     https://<app host>/api/cron/webhook-deliveries
--
--   webhook_deliveries_secret
--     The same random value configured as CRON_SECRET in Vercel.
--
-- Never commit either secret value to source control. Until both exist the
-- job fails on each run (visible in cron.job_run_details) and events simply
-- wait in webhook_events as 'pending'.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists supabase_vault with schema vault;
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.invoke_webhook_deliveries()
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
  -- Skip the HTTP call entirely when nothing is waiting.
  if not exists (select 1 from public.webhook_events where status = 'pending') then
    return null;
  end if;

  select decrypted_secret
    into v_url
    from vault.decrypted_secrets
   where name = 'webhook_deliveries_url';

  select decrypted_secret
    into v_secret
    from vault.decrypted_secrets
   where name = 'webhook_deliveries_secret';

  if nullif(btrim(v_url), '') is null then
    raise exception 'Vault secret webhook_deliveries_url is not configured';
  end if;

  if nullif(btrim(v_secret), '') is null then
    raise exception 'Vault secret webhook_deliveries_secret is not configured';
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

revoke all on function private.invoke_webhook_deliveries()
  from public, anon, authenticated;

do $$
declare
  v_job_id bigint;
begin
  select jobid
    into v_job_id
    from cron.job
   where jobname = 'webhook-deliveries-every-minute';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'webhook-deliveries-every-minute',
    '* * * * *',
    'select private.invoke_webhook_deliveries();'
  );
end;
$$;
