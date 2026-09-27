-- Hotels and apartments were sharing one marketplace pool (business_type =
-- 'hotel'), so an apartment tenant showed up under the "Hotels" tab and vice
-- versa with no way to tell them apart. business_type itself can't be split
-- into a third value for this — it also drives subdomain routing
-- (hotels.<domain> vs hostels.<domain>, see lib/tenant/host-classification.ts)
-- and platform_plans, neither of which the marketplace listing distinction
-- should touch. Instead, accommodation_type is a marketplace-only
-- sub-category within the existing 'hotel' business_type pool: 'hotel' for
-- full-service hotels, 'apartment' as the catch-all bucket for apartments,
-- guesthouses, and other short-let property types. Meaningless for
-- business_type = 'hostel' tenants (left at its default, never read there).
alter table public.tenants
  add column accommodation_type text not null default 'hotel'
  check (accommodation_type in ('hotel', 'apartment'));
