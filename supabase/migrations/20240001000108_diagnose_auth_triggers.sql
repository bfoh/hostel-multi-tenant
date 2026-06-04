-- Migration 108 — helper function so the diagnostic endpoint can list any
-- triggers that still exist on auth.users without needing direct DB access.
-- Also re-drops any remaining stray triggers by name variation.

create or replace function public.pg_get_auth_triggers()
returns jsonb language sql security definer as $$
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'trigger_name', t.tgname,
      'function',     p.proname,
      'timing',       case t.tgtype & 2 when 2 then 'BEFORE' else 'AFTER' end,
      'events',       array_remove(array[
        case when t.tgtype & 4  <> 0 then 'INSERT'  end,
        case when t.tgtype & 8  <> 0 then 'DELETE'  end,
        case when t.tgtype & 16 <> 0 then 'UPDATE'  end
      ], null)
    )),
    '[]'::jsonb
  )
  from   pg_trigger    t
  join   pg_class      c on c.oid = t.tgrelid
  join   pg_namespace  n on n.oid = c.relnamespace
  join   pg_proc       p on p.oid = t.tgfoid
  where  n.nspname = 'auth'
    and  c.relname = 'users'
    and  not t.tgisinternal;
$$;

grant execute on function public.pg_get_auth_triggers() to service_role;

-- Broaden the safety net: drop any common variant names for the stray trigger
drop trigger if exists on_auth_user_created     on auth.users;
drop trigger if exists create_profile           on auth.users;
drop trigger if exists on_new_user              on auth.users;
drop trigger if exists after_user_created       on auth.users;
drop trigger if exists user_signup_trigger      on auth.users;
drop trigger if exists trg_new_user             on auth.users;

drop function if exists public.handle_new_user();
