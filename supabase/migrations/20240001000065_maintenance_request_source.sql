-- Add source column to maintenance_requests
-- Tracks where a request originated: 'occupant_portal', 'staff_portal', 'public_qr', 'phone', etc.
-- Code already writes this value; column was previously missing in the schema cache.

alter table maintenance_requests
  add column if not exists source text;

create index if not exists idx_maintenance_requests_source
  on maintenance_requests (tenant_id, source)
  where source is not null;

-- Reload PostgREST schema cache so the new column is visible immediately
notify pgrst, 'reload schema';
