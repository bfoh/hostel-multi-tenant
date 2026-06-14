-- Migration 112 — Restore a default for tenants.enquiry_webhook_secret.
--
-- Migration 076 dropped the default to "force explicit opt-in", but no tenant
-- creation path sets the column, so every new-tenant insert (signup callback,
-- onboarding provision) failed with a NOT NULL violation — leaving owners with
-- no tenant/membership and the app treating them as staff. The default is a
-- unique UUID per row, so restoring it is safe and self-healing.

alter table tenants
  alter column enquiry_webhook_secret set default gen_random_uuid()::text;
