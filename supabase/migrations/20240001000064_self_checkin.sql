-- Self check-in via QR code support
-- - Adds 'pending_confirmation' to booking_status (between pending_payment and confirmed)
-- - Stores Ghana Card document refs + submission/confirmation timestamps on bookings
-- - Adds index for staff "pending self check-ins" inbox

-- 1. Extend booking_status enum
alter type booking_status add value if not exists 'pending_confirmation' before 'confirmed';

-- 2. Booking columns
alter table bookings
  add column if not exists self_checkin_submitted_at timestamptz,
  add column if not exists self_checkin_confirmed_at timestamptz,
  add column if not exists self_checkin_confirmed_by uuid references auth.users(id),
  add column if not exists ghana_card_front_doc_id   uuid references occupant_documents(id) on delete set null,
  add column if not exists ghana_card_back_doc_id    uuid references occupant_documents(id) on delete set null;

-- 3. Inbox index — partial index for unconfirmed self check-ins
create index if not exists bookings_self_checkin_pending_idx
  on bookings (tenant_id, self_checkin_submitted_at desc)
  where self_checkin_submitted_at is not null
    and self_checkin_confirmed_at is null;
