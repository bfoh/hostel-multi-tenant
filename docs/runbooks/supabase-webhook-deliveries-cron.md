# Supabase Webhook-Delivery Cron

Tenant webhooks are queued by database triggers (migration 147) and sent by
`/api/cron/webhook-deliveries`, which Supabase Cron calls every minute
(migration 148). `booking.cancelled` is still sent immediately by the
cancellation service and does not depend on this job.

## 1. Reuse the scheduler secret

The route checks the same `CRON_SECRET` as the booking-hold sweep
([supabase-booking-holds-cron.md](supabase-booking-holds-cron.md)). If that
runbook has been completed, Vercel already has it.

## 2. Configure Supabase Vault

In **Supabase Dashboard → Project Settings → Vault**, create:

| Name | Secret value |
| --- | --- |
| `webhook_deliveries_url` | `https://<app host>/api/cron/webhook-deliveries` |
| `webhook_deliveries_secret` | The exact same value as Vercel `CRON_SECRET` |

## 3. Apply the database migrations

After the application route has deployed and both Vault secrets exist:

```bash
npx supabase db push
```

Migration 147 installs the triggers and `claim_webhook_events()`. Migration
148 registers `webhook-deliveries-every-minute`. Events queue from the moment
147 is applied; until 148 runs successfully they wait as `pending`.

## 4. Verify

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'webhook-deliveries-every-minute';

select status, count(*)
from public.webhook_events
where created_at > now() - interval '1 hour'
group by status;
```

Failed runs (for example a missing Vault secret) appear in
`cron.job_run_details`.

## Delivery behaviour

- Body: `{ id, event, tenant_id, data, timestamp }`, signed in
  `X-GH-Hostels-Sig` as `sha256=<hex HMAC-SHA256 of the raw body>` using the
  endpoint secret. Event type is in `X-GH-Hostels-Event`.
- At least once: receivers should ignore an `id` they have already processed.
- A failed delivery is retried after 1, 4, 16, 64 and 256 minutes, then marked
  `failed`. Events for a paused endpoint are marked `failed` without sending.

## Rollback

```sql
select cron.unschedule('webhook-deliveries-every-minute');
```

To stop queueing as well, drop the four `*_webhook_events` triggers on
`bookings`, `booking_payments`, `maintenance_requests` and `occupants`.
