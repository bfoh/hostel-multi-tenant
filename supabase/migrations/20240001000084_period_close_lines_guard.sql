-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 084 — Extend period-close guard to journal_lines
--
-- Migration 082 added a trigger on journal_entries that blocks any
-- insert/update whose entry_date falls in a closed period. Lines don't
-- carry an entry_date themselves; they inherit it from the parent entry.
-- So today, once an entry exists, lines can still be inserted/updated/
-- deleted against it even after the period is closed — a corner-case
-- hole the lock should plug.
--
-- This trigger resolves the parent entry's entry_date + tenant_id and
-- defers to the same period-status check used for entries.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function check_line_parent_period_not_closed()
returns trigger language plpgsql as $$
declare
  v_status      accounting_period_status;
  v_entry_date  date;
  v_tenant_id   uuid;
  v_target_id   uuid;
begin
  -- For INSERT and UPDATE: check the entry the line is attached to
  -- For DELETE: also block when parent entry is in a closed period
  if (tg_op = 'DELETE') then
    v_target_id := old.entry_id;
  else
    v_target_id := new.entry_id;
  end if;

  select entry_date, tenant_id
    into v_entry_date, v_tenant_id
  from journal_entries
  where id = v_target_id;

  if v_entry_date is null then
    -- Orphan line or entry already deleted via cascade — let the operation through
    return coalesce(new, old);
  end if;

  select status into v_status
  from accounting_periods
  where tenant_id = v_tenant_id
    and year      = extract(year  from v_entry_date)::smallint
    and month     = extract(month from v_entry_date)::smallint;

  if v_status = 'closed' then
    raise exception 'Cannot modify journal lines on entry %: period %-% is closed',
      v_target_id,
      extract(year  from v_entry_date),
      extract(month from v_entry_date);
  end if;

  return coalesce(new, old);
end;
$$;

create trigger journal_lines_period_guard
  before insert or update or delete on journal_lines
  for each row execute function check_line_parent_period_not_closed();
