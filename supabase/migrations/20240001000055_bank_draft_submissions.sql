-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 055 — Bank Draft Submissions
-- Adds 'bank_draft' as a payment method, draft-specific columns on
-- booking_payments, a partial unique index enforcing one in-flight draft
-- per booking, and tenant-level bank deposit account fields.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Allow 'bank_draft' as a payment method on booking_payments.method
alter type payment_method add value if not exists 'bank_draft';

-- 2. Draft-specific columns on booking_payments. All nullable; only used
--    when method='bank_draft'.
alter table booking_payments
  add column if not exists draft_file_path     text,
  add column if not exists draft_bank_name     text,
  add column if not exists draft_number        text,
  add column if not exists draft_deposit_date  date,
  add column if not exists draft_note          text
    check (draft_note is null or char_length(draft_note) <= 140),
  add column if not exists rejected_reason     text
    check (rejected_reason is null or char_length(rejected_reason) <= 500),
  add column if not exists rejected_by         uuid references auth.users(id),
  add column if not exists rejected_at         timestamptz,
  add column if not exists approved_by         uuid references auth.users(id),
  add column if not exists approved_at         timestamptz;

-- 3. DB-level guarantee: one pending bank-draft per booking at a time.
create unique index if not exists booking_payments_one_pending_draft
  on booking_payments (booking_id)
  where status = 'pending' and method = 'bank_draft';

-- 4. Tenant bank deposit details.
alter table tenants
  add column if not exists bank_name             text,
  add column if not exists bank_branch           text,
  add column if not exists bank_account_name     text,
  add column if not exists bank_account_number   text,
  add column if not exists bank_swift_code       text,
  add column if not exists bank_instructions     text
    check (bank_instructions is null or char_length(bank_instructions) <= 280),
  add column if not exists bank_deposits_enabled boolean not null default false;

-- 5. RLS additions for booking_payments.
--    Existing policies already restrict by tenant. Add:
--      - occupants can INSERT pending bank-draft rows on their own bookings
--      - occupants can DELETE their own pending bank-draft rows (cancel)
--      - owner/accountant can UPDATE status, approval, and rejection fields

-- (Booking_payments already has RLS enabled in migration 001; we just add policies.)

create policy "occupant inserts own pending bank draft"
  on booking_payments for insert
  to authenticated
  with check (
    method = 'bank_draft'
    and status = 'pending'
    and exists (
      select 1
        from bookings b
        join occupants o on o.id = b.occupant_id
        join tenants  t on t.id = b.tenant_id
       where b.id = booking_payments.booking_id
         and b.tenant_id = booking_payments.tenant_id
         and o.user_id = auth.uid()
         and t.bank_deposits_enabled = true
    )
  );

create policy "occupant cancels own pending bank draft"
  on booking_payments for delete
  to authenticated
  using (
    method = 'bank_draft'
    and status = 'pending'
    and exists (
      select 1
        from bookings b
        join occupants o on o.id = b.occupant_id
       where b.id = booking_payments.booking_id
         and b.tenant_id = booking_payments.tenant_id
         and o.user_id = auth.uid()
    )
  );

create policy "owner or accountant approves or rejects bank draft"
  on booking_payments for update
  to authenticated
  using (
    method = 'bank_draft'
    and tenant_id in (
      select tm.tenant_id
        from tenant_members tm
       where tm.user_id = auth.uid()
         and tm.is_active
         and tm.role in ('owner', 'accountant')
    )
  )
  with check (
    method = 'bank_draft'
    and tenant_id in (
      select tm.tenant_id
        from tenant_members tm
       where tm.user_id = auth.uid()
         and tm.is_active
         and tm.role in ('owner', 'accountant')
    )
  );

-- 6. Index for the queue page query (status + method + tenant + created_at).
create index if not exists idx_booking_payments_pending_drafts
  on booking_payments (tenant_id, created_at)
  where status = 'pending' and method = 'bank_draft';

-- 7. Trigger: when a booking is cancelled, auto-fail any pending bank drafts on it.
--    (Spec §12 edge case 3.) Reason text is fixed; no SMS dispatched from the
--    trigger — the cancellation flow itself is the cancellation notification.
create or replace function fail_pending_drafts_on_booking_cancel()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update booking_payments
       set status          = 'failed',
           rejected_reason = 'booking cancelled',
           rejected_at     = now()
     where booking_id = new.id
       and method     = 'bank_draft'
       and status     = 'pending';
  end if;
  return new;
end $$;

drop trigger if exists fail_drafts_on_cancel on bookings;
create trigger fail_drafts_on_cancel
  after update of status on bookings
  for each row execute function fail_pending_drafts_on_booking_cancel();
