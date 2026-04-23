-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 052 — Financial Controls
-- Shift close-outs, expense approval, discount policies
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Shift close-out records ─────────────────────────────────────────────────

create table shift_closeouts (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  staff_id        uuid not null references auth.users(id),
  shift_date      date not null,
  system_cash     integer not null default 0,    -- pesewas: system-computed cash total
  declared_cash   integer not null default 0,    -- pesewas: staff-declared cash count
  discrepancy     integer generated always as (declared_cash - system_cash) stored,
  system_digital  integer not null default 0,    -- pesewas: system-computed digital total
  payment_count   integer not null default 0,
  notes           text,
  status          text not null default 'pending'
                  check (status in ('pending', 'approved', 'flagged')),
  reviewed_by     uuid references auth.users(id),
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger shift_closeouts_updated_at
  before update on shift_closeouts
  for each row execute function set_updated_at();

create index on shift_closeouts (tenant_id, shift_date desc);
create index on shift_closeouts (tenant_id, staff_id);
create index on shift_closeouts (tenant_id, status);

alter table shift_closeouts enable row level security;

create policy "tenant members can manage shift closeouts"
  on shift_closeouts for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );

-- ── Expense approval workflow ────────────────────────────────────────────────

alter table expenses
  add column if not exists approval_status text not null default 'approved'
    check (approval_status in ('pending', 'approved', 'rejected')),
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists approved_at timestamptz,
  add column if not exists rejection_reason text;

-- Backfill: all existing expenses are auto-approved
update expenses set approval_status = 'approved' where approval_status is null;

-- ── Discount policies ────────────────────────────────────────────────────────

create table discount_policies (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references tenants(id) on delete cascade,
  max_auto_pct            smallint not null default 10,   -- staff can auto-approve up to this %
  requires_approval_above smallint not null default 10,   -- above this %, requires manager/owner
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (tenant_id)
);

create trigger discount_policies_updated_at
  before update on discount_policies
  for each row execute function set_updated_at();

alter table discount_policies enable row level security;

create policy "tenant members can manage discount policies"
  on discount_policies for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );
