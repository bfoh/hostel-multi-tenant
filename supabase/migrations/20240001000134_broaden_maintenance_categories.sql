-- Broadens maintenance_category so the existing guest "Report Issue" flow
-- and staff queue (maintenance_requests) can also cover genuine service
-- requests that aren't maintenance issues at all — "bring extra towels" or
-- "book me a taxi" was previously forced into 'cleaning'/'other'. This
-- reuses the existing table/RLS/staff-queue wholesale rather than building
-- a parallel "service_requests" table for the same guest-submission +
-- staff-triage shape.
--
-- ALTER TYPE ... ADD VALUE cannot run inside the same transaction as the
-- type's own creation, but this migration runs in its own transaction long
-- after 202400010000135 created the type, so that restriction doesn't
-- apply here.
alter type maintenance_category add value if not exists 'housekeeping';
alter type maintenance_category add value if not exists 'transport';
alter type maintenance_category add value if not exists 'food';
alter type maintenance_category add value if not exists 'amenity';
