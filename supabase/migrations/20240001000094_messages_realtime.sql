-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 094 — Realtime for the messaging tables
--
-- Migration 073 created the messaging schema but never added the tables to
-- the `supabase_realtime` publication, so the thread view's
-- postgres_changes subscriptions never received INSERT/UPDATE events —
-- messages only appeared after a manual refresh.
--
-- This adds messages + message_reactions to the publication and sets
-- REPLICA IDENTITY FULL so UPDATE/DELETE payloads carry the old row
-- (the reaction-removed handler relies on payload.old.user_id/emoji).
-- ═══════════════════════════════════════════════════════════════════════════

alter table messages          replica identity full;
alter table message_reactions replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table message_reactions;
  end if;
end $$;
