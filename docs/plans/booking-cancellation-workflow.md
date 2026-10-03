# Booking Cancellation Workflow Plan

## Objective

Make every booking cancellation consistent, authorized, auditable, idempotent,
and safe around room capacity and payments.

## Invariants

- Only `enquiry`, `pending_confirmation`, `pending_payment`, and `confirmed`
  bookings can be cancelled.
- `checked_in`, `checked_out`, `no_show`, and `cancelled` are not cancellable.
- `cancelled` is terminal. Restoring a cancellation requires a future explicit
  workflow that rechecks room capacity.
- Normal status and bulk APIs enforce the operational state machine. The
  existing renewal workflow may intentionally reactivate a checked-out stay
  after extending its dates; this is not a cancellation restoration.
- Every new cancellation records a timestamp, reason, source, and actor when
  a human initiated it.
- Cancellation never rewrites a room's manual maintenance/blocked status.
- Cancellation never erases or silently refunds financial history.
- A late successful online payment is recorded and queued for resolution.

## Delivery plan

- [x] Add cancellation metadata and conservative legacy backfill.
- [x] Add a row-locking, service-role-only `cancel_booking` RPC.
- [x] Add database guards for valid cancellation transitions and terminality.
- [x] Emit exact lifecycle audit actions such as `booking.cancelled`.
- [x] Route single, bulk, group, self-check-in, and AI cancellations through
      one application service.
- [x] Enforce owner/manager authorization for cancellation.
- [x] Require a reason in single and bulk cancellation UI.
- [x] Send guest/admin notifications and external webhooks from the shared
      service using the real booking reference and occupant phone.
- [x] Standardize online holds with `hold_expires_at`.
- [x] Replace visitor-triggered cleanup with a Supabase `pg_cron` hold sweep.
- [x] Track late payments against cancelled bookings in a resolution queue.
- [ ] Apply migration 140 in staging.
- [ ] Store `booking_holds_sweep_url` and `booking_holds_sweep_secret` in
      Supabase Vault.
- [ ] Apply migration 141 and verify the Supabase Cron job is active.
- [ ] Run the hold sweep manually with `CRON_SECRET` and verify logs.
- [ ] Verify email/SMS delivery with staging notification credentials.
- [ ] Deploy application code, then verify the five-minute Supabase scheduler.
- [ ] Monitor cancellation failures and payment exceptions for 48 hours.

## Rollback strategy

The new columns and exception table are additive. If application rollback is
required, the legacy sweep RPCs remain available and were upgraded to write
complete cancellation metadata. Do not drop migration 140 after it has handled
production cancellations; roll application code forward instead.
