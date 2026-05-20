-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 082 — Period close
--
-- accounting_periods records the close state per (tenant, year, month). When
-- a period is closed, a trigger blocks any new journal entries — or edits
-- to existing entries — whose entry_date falls in that month. Reopen is
-- intentionally a manual admin operation.
--
-- The close itself is performed by an API route that posts a single
-- closing journal entry zeroing the period's revenue and expense accounts
-- and routing the net to 3100 Retained Earnings. The entry is recorded
-- before the period row flips to 'closed' so the trigger doesn't block it.
-- ═══════════════════════════════════════════════════════════════════════════

create type accounting_period_status as enum ('open', 'closed');

create table accounting_periods (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  year              smallint not null check (year between 2000 and 2100),
  month             smallint not null check (month between 1 and 12),
  status            accounting_period_status not null default 'closed',
  closed_at         timestamptz,
  closed_by         uuid references auth.users(id) on delete set null,
  closing_entry_id  uuid references journal_entries(id) on delete set null,
  net_profit        integer,                          -- pesewas, snapshotted at close
  revenue_total     integer,
  expense_total     integer,
  notes             text,
  created_at        timestamptz not null default now(),

  unique (tenant_id, year, month)
);

create index on accounting_periods (tenant_id, year desc, month desc);

alter table accounting_periods enable row level security;

create policy "tenant members read periods"
  on accounting_periods for select
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid()));

-- ── Guard: block journal entries in closed periods ────────────────────────
create or replace function check_period_not_closed()
returns trigger language plpgsql as $$
declare
  v_status accounting_period_status;
begin
  select status into v_status
  from accounting_periods
  where tenant_id = new.tenant_id
    and year      = extract(year  from new.entry_date)::smallint
    and month     = extract(month from new.entry_date)::smallint;
  if v_status = 'closed' then
    raise exception 'Cannot post journal entry on %: period %-% is closed',
      new.entry_date,
      extract(year  from new.entry_date),
      extract(month from new.entry_date);
  end if;
  return new;
end;
$$;

create trigger journal_entries_period_guard
  before insert or update of entry_date, tenant_id on journal_entries
  for each row execute function check_period_not_closed();
