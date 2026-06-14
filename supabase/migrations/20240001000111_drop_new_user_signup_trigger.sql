-- Migration 111 — Drop the stray on_new_user_signup trigger that throws
-- "Database error saving new user" during signup.
--
-- This AFTER INSERT trigger on auth.users (function handle_new_user_signup)
-- was added out-of-band via the SQL editor and is not part of any migration.
-- This project provisions tenants in the auth callback route, so the trigger
-- is not needed and breaks every new-user insert. Migrations 107/108 dropped
-- earlier name variants; this one was missed.

drop trigger if exists on_new_user_signup on auth.users;
drop function if exists public.handle_new_user_signup() cascade;
