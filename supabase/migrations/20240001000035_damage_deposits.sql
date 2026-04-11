-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 035 — Damage Deposits
-- ═══════════════════════════════════════════════════════════════════════════

create table damage_deposits (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  booking_id     uuid not null references bookings(id) on delete cascade,
  occupant_id    uuid not null references occupants(id) on delete cascade,
  amount         integer not null check (amount > 0),       -- pesewas
  method         text not null check (method in ('cash','momo_mtn','momo_vodafone','momo_airteltigo','bank_transfer','card','cheque')),
  reference      text,
  collected_at   timestamptz not null default now(),
  status         text not null default 'held'
                 check (status in ('held','refunded','forfeited','partial_refund')),
  refund_amount  integer check (refund_amount >= 0),        -- pesewas, null if not yet resolved
  refund_reason  text,
  resolved_at    timestamptz,
  notes          text,
  collected_by   uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (booking_id)  -- one deposit record per booking
);

create trigger damage_deposits_updated_at
  before update on damage_deposits
  for each row execute function set_updated_at();

create index on damage_deposits (tenant_id, status);
create index on damage_deposits (booking_id);
create index on damage_deposits (occupant_id);

alter table damage_deposits enable row level security;

create policy "tenant members can manage damage deposits"
  on damage_deposits for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );
