-- Adds a staff moderation gate + a "feature this on the public listing page"
-- flag to occupant_feedback, closing the loop on what was already a fully
-- working guest-review submission flow with no way to publish any of it.
--
-- Every review submitted before this migration existed with no moderation
-- concept at all, so it's grandfathered straight to 'approved' below —
-- nothing already-collected should suddenly need a staff action it never
-- needed before. Every review submitted from here on starts 'pending'
-- (the column default), requiring an explicit staff Approve/Reject.
alter table occupant_feedback
  add column status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  add column featured boolean not null default false;

update occupant_feedback set status = 'approved';

create index on occupant_feedback (tenant_id, status);
-- Public testimonials query filters status='approved' and featured=true.
create index on occupant_feedback (tenant_id, featured) where featured = true;
