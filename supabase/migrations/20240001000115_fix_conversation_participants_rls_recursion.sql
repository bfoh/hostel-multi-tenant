-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 115 — Fix infinite RLS recursion on conversation_participants
--
-- Migration 073's "participants_visible" policy on conversation_participants
-- queries conversation_participants from within its own USING clause:
--
--   conversation_id in (
--     select conversation_id from conversation_participants where user_id = auth.uid()
--   )
--
-- Selecting from conversation_participants under RLS always re-evaluates
-- this same policy, which runs the same subquery again, which re-evaluates
-- the policy again — Postgres detects the cycle and raises "infinite
-- recursion detected in policy for relation conversation_participants" for
-- ANY authenticated (non-service-role) query that touches this table.
--
-- That includes the other policies in migration 073 that check membership
-- the same way (on conversations, messages, message_reactions), Realtime
-- postgres_changes subscriptions on any of those tables, and this repo's
-- own migration 114 fix for the messages storage bucket, whose INSERT
-- policy queries conversation_participants to verify the caller is a
-- participant — discovered because that fix's own test suite reproduced
-- this error on every case, allow and deny alike.
--
-- Standard fix: move the membership check into a SECURITY DEFINER helper
-- function. Functions run with the privileges of their owner (postgres, a
-- superuser, since migrations execute as postgres) — superusers bypass RLS
-- entirely, so the query inside the function does not re-trigger the policy
-- that calls it.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from conversation_participants
     where conversation_id = p_conversation_id
       and user_id = auth.uid()
  )
$$;

grant execute on function public.is_conversation_participant(uuid) to authenticated;

drop policy if exists "participants_visible" on conversation_participants;
create policy "participants_visible"
  on conversation_participants for select
  using (public.is_conversation_participant(conversation_id));
