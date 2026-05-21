-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 091 — Make non-booking FKs to rooms ON DELETE SET NULL
--
-- The room-delete API already blocks deletion when bookings exist. But other
-- tables that reference rooms — chiefly maintenance_requests — were created
-- with the default ON DELETE NO ACTION, so even when the room has no
-- bookings, attempting to delete it raises:
--     ERROR: update or delete on table "rooms" violates foreign key
--            constraint "..." on table "maintenance_requests"
--     (SQLSTATE 23503)
--
-- Surfacing as: "Cannot delete: room is referenced by other records."
--
-- This migration walks every FK pointing at rooms(id) whose action is
-- NO ACTION (PG default), excludes bookings (kept RESTRICT as a real
-- safety net for billable data), and rewrites the rest to SET NULL so
-- the historic record survives the room deletion without an orphaned
-- pointer.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  r record;
  v_col text;
begin
  for r in
    select  con.conname,
            con.conrelid::regclass::text as tbl
    from    pg_constraint con
    join    pg_class cl on cl.oid = con.conrelid
    where   con.confrelid = 'rooms'::regclass
      and   con.contype   = 'f'
      and   con.confdeltype in ('a', 'r')           -- NO ACTION or RESTRICT
      and   con.conrelid <> 'bookings'::regclass    -- keep bookings as the gate
  loop
    -- resolve the referencing column name(s)
    select string_agg(att.attname, ',')
    into   v_col
    from   pg_attribute att
    join   pg_constraint con on con.conrelid = att.attrelid
    where  con.conname = r.conname
      and  att.attnum  = any (con.conkey);

    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I foreign key (%s) references rooms(id) on delete set null',
                   r.tbl, r.conname, v_col);
  end loop;
end $$;
