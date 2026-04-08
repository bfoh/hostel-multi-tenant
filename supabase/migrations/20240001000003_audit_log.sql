-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 004 — Audit Log (append-only)
-- Immutable record of all significant actions in the system.
-- RLS: INSERT only — no UPDATE or DELETE ever.
-- ═══════════════════════════════════════════════════════════════════════════

create table audit_log (
  id           bigserial primary key,
  tenant_id    uuid not null,                      -- not FK — survives tenant deletion
  actor_id     uuid,                               -- auth.users.id (null = system)
  actor_name   text,
  actor_role   text,
  action       text not null,                      -- e.g. 'booking.created', 'payment.voided'
  entity_type  text,                               -- 'booking' | 'invoice' | 'room' | ...
  entity_id    uuid,
  description  text,
  old_values   jsonb,
  new_values   jsonb,
  ip_address   text,
  user_agent   text,
  occurred_at  timestamptz not null default now()
);

comment on table audit_log is
  'Append-only audit trail. No UPDATE or DELETE policies — immutable by design.';

-- Indexes for owner dashboard queries
create index on audit_log (tenant_id, occurred_at desc);
create index on audit_log (tenant_id, entity_type, entity_id);
create index on audit_log (actor_id) where actor_id is not null;

-- ── RLS: INSERT only — no updates/deletes ever ────────────────────────────────

alter table audit_log enable row level security;

-- Staff can read their tenant's audit log (owner sees all; others see their own actions)
create policy "owners_can_read_audit_log"
  on audit_log for select
  using (
    tenant_id = public.tenant_id()
    and public.tenant_role() in ('owner', 'manager')
  );

-- Any authenticated tenant member can insert (write their own actions)
-- The application layer is responsible for setting correct values.
create policy "members_can_insert_audit_log"
  on audit_log for insert
  with check (tenant_id = public.tenant_id());

-- NO UPDATE policy — no UPDATE ever allowed
-- NO DELETE policy — no DELETE ever allowed

-- ── Trigger: auto-write audit entries for bookings ────────────────────────────
-- This trigger captures booking status changes automatically so the application
-- never forgets to write an audit entry.

create or replace function trg_audit_booking_status()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    insert into audit_log (tenant_id, action, entity_type, entity_id, description, new_values)
    values (
      new.tenant_id,
      'booking.created',
      'booking',
      new.id,
      'Booking ' || new.booking_ref || ' created',
      jsonb_build_object('status', new.status, 'booking_ref', new.booking_ref)
    );
  elsif tg_op = 'UPDATE' and old.status <> new.status then
    insert into audit_log (tenant_id, action, entity_type, entity_id, description, old_values, new_values)
    values (
      new.tenant_id,
      'booking.status_changed',
      'booking',
      new.id,
      'Booking ' || new.booking_ref || ' status changed from ' || old.status || ' to ' || new.status,
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status)
    );
  end if;
  return coalesce(new, old);
end;
$$;

create trigger audit_booking_status
  after insert or update on bookings
  for each row execute function trg_audit_booking_status();

-- ── Trigger: auto-write audit entries for payments ───────────────────────────

create or replace function trg_audit_payment()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    insert into audit_log (tenant_id, action, entity_type, entity_id, description, new_values)
    values (
      new.tenant_id,
      'payment.recorded',
      'booking_payment',
      new.id,
      'Payment of GHS ' || (new.amount::numeric / 100)::text || ' recorded via ' || new.method,
      jsonb_build_object('amount', new.amount, 'method', new.method, 'status', new.status)
    );
  elsif tg_op = 'UPDATE' and old.status <> new.status then
    insert into audit_log (tenant_id, action, entity_type, entity_id, description, old_values, new_values)
    values (
      new.tenant_id,
      'payment.status_changed',
      'booking_payment',
      new.id,
      'Payment status changed from ' || old.status || ' to ' || new.status,
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status)
    );
  end if;
  return coalesce(new, old);
end;
$$;

create trigger audit_payment
  after insert or update on booking_payments
  for each row execute function trg_audit_payment();
