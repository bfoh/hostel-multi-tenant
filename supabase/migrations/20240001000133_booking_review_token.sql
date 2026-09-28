-- A disposable, opaque link for the post-checkout "rate your stay" email —
-- lets a guest land on their own booking's feedback tab pre-filled, instead
-- of retyping booking ref + phone (today's only portal-access method,
-- unchanged and still required for anyone without the link). Generated at
-- checkout, never regenerated, never exposes the phone number itself in a
-- URL — the token resolves server-side to booking_ref + phone.
alter table bookings
  add column review_token uuid unique;
