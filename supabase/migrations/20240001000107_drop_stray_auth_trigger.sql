-- Migration 107 — Drop stray auth.users trigger that causes
-- "Database error saving new user" during signup.
--
-- The most common culprit is a handle_new_user() trigger added via
-- the Supabase SQL editor (outside migrations) as part of an early
-- setup guide. This project provisions tenants in the auth callback
-- route instead, so the trigger is not needed and must be removed.
-- IF EXISTS makes this a no-op on databases that don't have it.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
