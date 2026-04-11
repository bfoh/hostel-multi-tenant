-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 033 — Post-checkout Feedback
-- ═══════════════════════════════════════════════════════════════════════════

create table occupant_feedback (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  booking_id          uuid not null references bookings(id) on delete cascade,
  occupant_id         uuid references occupants(id) on delete set null,
  overall_rating      smallint not null check (overall_rating between 1 and 5),
  cleanliness_rating  smallint check (cleanliness_rating between 1 and 5),
  staff_rating        smallint check (staff_rating between 1 and 5),
  value_rating        smallint check (value_rating between 1 and 5),
  would_recommend     boolean,
  comments            text,
  submitted_at        timestamptz not null default now(),
  created_at          timestamptz not null default now(),

  unique (booking_id)  -- one feedback per booking
);

create index on occupant_feedback (tenant_id, submitted_at desc);
create index on occupant_feedback (tenant_id, overall_rating);

alter table occupant_feedback enable row level security;

-- Staff read only
create policy "tenant members can read feedback"
  on occupant_feedback for select
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );

-- Public insert via service-role API (no auth required — portal submission)
-- Managed via admin client in API route
