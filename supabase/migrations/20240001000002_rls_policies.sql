-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 003 — Row Level Security Policies
-- All tenant data is isolated by tenant_id via JWT claims.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Helper: extract tenant_id from JWT ───────────────────────────────────────

create or replace function public.tenant_id() returns uuid language sql stable security definer as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id',
    ''
  )::uuid
$$;

create or replace function public.tenant_role() returns text language sql stable security definer as $$
  select current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_role'
$$;

-- ── Enable RLS on all tenant tables ──────────────────────────────────────────

alter table tenants          enable row level security;
alter table tenant_members   enable row level security;
alter table room_categories  enable row level security;
alter table rooms            enable row level security;
alter table occupants        enable row level security;
alter table bookings         enable row level security;
alter table booking_payments enable row level security;

-- ── tenants ───────────────────────────────────────────────────────────────────
-- A user can read their own tenant row.
-- Only platform admins (service role) can insert/update.

create policy "tenant_members_can_read_own_tenant"
  on tenants for select
  using (id = public.tenant_id());

-- ── tenant_members ────────────────────────────────────────────────────────────

create policy "members_can_read_own_tenant_members"
  on tenant_members for select
  using (tenant_id = public.tenant_id());

create policy "owners_managers_can_manage_members"
  on tenant_members for all
  using (
    tenant_id = public.tenant_id()
    and public.tenant_role() in ('owner', 'manager')
  );

-- ── room_categories ───────────────────────────────────────────────────────────

create policy "all_staff_can_read_categories"
  on room_categories for select
  using (tenant_id = public.tenant_id());

create policy "owners_managers_can_manage_categories"
  on room_categories for all
  using (
    tenant_id = public.tenant_id()
    and public.tenant_role() in ('owner', 'manager')
  );

-- ── rooms ─────────────────────────────────────────────────────────────────────

create policy "all_staff_can_read_rooms"
  on rooms for select
  using (tenant_id = public.tenant_id());

create policy "staff_can_update_rooms"
  on rooms for update
  using (
    tenant_id = public.tenant_id()
    and public.tenant_role() in ('owner', 'manager', 'receptionist', 'housekeeper')
  );

create policy "owners_managers_can_insert_delete_rooms"
  on rooms for insert
  with check (
    tenant_id = public.tenant_id()
    and public.tenant_role() in ('owner', 'manager')
  );

-- ── occupants ─────────────────────────────────────────────────────────────────

create policy "staff_can_read_occupants"
  on occupants for select
  using (
    tenant_id = public.tenant_id()
    and public.tenant_role() in ('owner','manager','receptionist','accountant','security')
  );

create policy "occupants_can_read_own_record"
  on occupants for select
  using (
    tenant_id = public.tenant_id()
    and public.tenant_role() = 'occupant'
    and auth.uid() in (
      select user_id from tenant_members
      where tenant_id = public.tenant_id()
    )
  );

create policy "reception_can_manage_occupants"
  on occupants for all
  using (
    tenant_id = public.tenant_id()
    and public.tenant_role() in ('owner','manager','receptionist')
  );

-- ── bookings ──────────────────────────────────────────────────────────────────

create policy "staff_can_read_bookings"
  on bookings for select
  using (
    tenant_id = public.tenant_id()
    and public.tenant_role() in ('owner','manager','receptionist','accountant','security')
  );

create policy "reception_can_manage_bookings"
  on bookings for insert
  with check (
    tenant_id = public.tenant_id()
    and public.tenant_role() in ('owner','manager','receptionist')
  );

create policy "reception_can_update_bookings"
  on bookings for update
  using (
    tenant_id = public.tenant_id()
    and public.tenant_role() in ('owner','manager','receptionist')
  );

create policy "managers_can_delete_bookings"
  on bookings for delete
  using (
    tenant_id = public.tenant_id()
    and public.tenant_role() in ('owner','manager')
  );

-- ── booking_payments ──────────────────────────────────────────────────────────

create policy "finance_staff_can_read_payments"
  on booking_payments for select
  using (
    tenant_id = public.tenant_id()
    and public.tenant_role() in ('owner','manager','receptionist','accountant')
  );

create policy "reception_accountant_can_record_payments"
  on booking_payments for insert
  with check (
    tenant_id = public.tenant_id()
    and public.tenant_role() in ('owner','manager','receptionist','accountant')
  );

create policy "managers_can_reverse_payments"
  on booking_payments for update
  using (
    tenant_id = public.tenant_id()
    and public.tenant_role() in ('owner','manager','accountant')
  );
