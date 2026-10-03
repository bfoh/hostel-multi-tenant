# Supabase Booking-Hold Cron

The booking-hold sweep runs every five minutes from Supabase Cron. Supabase
calls the protected application route, so expired holds use the same canonical
cancellation service, audit trail, notifications, and webhooks as staff
cancellations.

## 1. Generate one shared secret

```bash
openssl rand -hex 32
```

Keep the value private. Do not commit it or prefix it with `NEXT_PUBLIC_`.

## 2. Configure Vercel

In the Vercel project, open **Settings → Environment Variables** and add:

```text
CRON_SECRET=<the generated value>
```

Apply it to Production and redeploy. The application endpoint fails closed
with HTTP 401 when this variable is absent or incorrect.

## 3. Configure Supabase Vault

In **Supabase Dashboard → Project Settings → Vault**, create these secrets:

| Name | Secret value |
| --- | --- |
| `booking_holds_sweep_url` | `https://app.abremponghostel.com/api/cron/booking-holds-sweep` |
| `booking_holds_sweep_secret` | The exact same value as Vercel `CRON_SECRET` |

Vault encrypts these values at rest. Do not place the real values in a
migration or SQL file.

## 4. Apply the database migrations

After the application route has deployed and both Vault secrets exist:

```bash
npx supabase db push
```

Migration 141 enables `pg_cron` and `pg_net`, installs the protected invocation
function, and registers `booking-holds-sweep-every-five-minutes`.

## 5. Verify

Confirm the job exists:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'booking-holds-sweep-every-five-minutes';
```

Trigger one asynchronous request manually:

```sql
select private.invoke_booking_holds_sweep() as request_id;
```

After a few seconds, inspect recent HTTP responses:

```sql
select id, status_code, error_msg, content, created
from net._http_response
order by created desc
limit 10;
```

Expected status is `200`. A `207` means the sweep completed but one or more
individual booking cancellations failed and should be investigated. A `401`
means the Vault and Vercel secret values do not match.

Review scheduler execution history with:

```sql
select status, return_message, start_time, end_time
from cron.job_run_details
where jobid = (
  select jobid
  from cron.job
  where jobname = 'booking-holds-sweep-every-five-minutes'
)
order by start_time desc
limit 20;
```

## Secret rotation

Generate a new value, update `CRON_SECRET` in Vercel, redeploy, and then update
`booking_holds_sweep_secret` in Vault. Perform the two updates close together;
requests made while the values differ will safely return HTTP 401.
