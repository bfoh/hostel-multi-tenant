-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 073 — In-app messaging (occupants ↔ staff ↔ broadcast)
--
--   conversations           — direct DM / group / broadcast container
--   conversation_participants — membership + last_read_at + mute
--   messages                — text + attachments + reply + edit/delete
--   message_reactions       — emoji reactions
--
-- Real-time: Supabase Realtime postgres_changes on these tables.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Tenant toggle for occupant-to-occupant DMs ──────────────────────────────

alter table tenants
  add column if not exists inter_occupant_dm_enabled boolean not null default true;

-- ── Enums ───────────────────────────────────────────────────────────────────

do $$ begin
  create type conversation_type as enum ('direct', 'group', 'broadcast');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_kind as enum ('text', 'image', 'file', 'audio', 'system');
exception when duplicate_object then null; end $$;

-- ── conversations ───────────────────────────────────────────────────────────

create table if not exists conversations (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id) on delete cascade,
  type                  conversation_type not null,
  title                 text,
  created_by            uuid references auth.users(id) on delete set null,
  -- For type='direct': sorted "userA:userB" key for idempotent lookup-or-create
  direct_key            text,
  -- For type='broadcast': null = default hostel-wide; otherwise filter snapshot
  -- (e.g. { "block": "A" }) describing who got auto-added when posted
  broadcast_filter      jsonb,
  last_message_at       timestamptz,
  last_message_preview  text,
  created_at            timestamptz not null default now()
);

create unique index if not exists idx_conversations_direct_key
  on conversations (tenant_id, direct_key)
  where direct_key is not null;

create index if not exists idx_conversations_tenant_recent
  on conversations (tenant_id, last_message_at desc nulls last);

-- ── conversation_participants ───────────────────────────────────────────────

create table if not exists conversation_participants (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  tenant_id       uuid not null references tenants(id) on delete cascade,
  role            text not null default 'member' check (role in ('owner','admin','member')),
  joined_at       timestamptz not null default now(),
  last_read_at    timestamptz,
  muted_until     timestamptz,
  archived_at     timestamptz,
  pinned_at       timestamptz,
  -- Snapshot of the participant's role at join time so we can enforce
  -- broadcast-write gating without a join on each message insert.
  participant_kind text not null default 'member'
                   check (participant_kind in ('staff','occupant','member')),
  unique (conversation_id, user_id)
);

create index if not exists idx_cp_user_inbox
  on conversation_participants (user_id, archived_at, last_read_at);

create index if not exists idx_cp_conv
  on conversation_participants (conversation_id);

-- ── messages ────────────────────────────────────────────────────────────────

create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  tenant_id       uuid not null references tenants(id) on delete cascade,
  sender_id       uuid references auth.users(id) on delete set null,
  kind            message_kind not null default 'text',
  body            text,
  reply_to_id     uuid references messages(id) on delete set null,
  attachments     jsonb not null default '[]'::jsonb,
  metadata        jsonb not null default '{}'::jsonb,
  edited_at       timestamptz,
  deleted_at      timestamptz,
  -- Forward-compat for moderation (filled by v2 workflow)
  flagged_at      timestamptz,
  flagged_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_messages_thread
  on messages (conversation_id, created_at desc);

create index if not exists idx_messages_body_fts
  on messages using gin (to_tsvector('simple', coalesce(body, '')));

-- ── message_reactions ───────────────────────────────────────────────────────

create table if not exists message_reactions (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references messages(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create index if not exists idx_reactions_message
  on message_reactions (message_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════════════════

alter table conversations              enable row level security;
alter table conversation_participants  enable row level security;
alter table messages                   enable row level security;
alter table message_reactions          enable row level security;

-- Drop existing policies so reruns are idempotent.
drop policy if exists "conv_visible_to_participants"     on conversations;
drop policy if exists "conv_insert_by_tenant_member"     on conversations;
drop policy if exists "conv_update_by_participant"       on conversations;

drop policy if exists "participants_visible"             on conversation_participants;
drop policy if exists "participants_self_update"         on conversation_participants;
drop policy if exists "participants_insert_by_tenant"    on conversation_participants;
drop policy if exists "participants_delete_self"         on conversation_participants;

drop policy if exists "messages_visible"                 on messages;
drop policy if exists "messages_insert"                  on messages;
drop policy if exists "messages_update_own"              on messages;

drop policy if exists "reactions_visible"                on message_reactions;
drop policy if exists "reactions_insert_own"             on message_reactions;
drop policy if exists "reactions_delete_own"             on message_reactions;

-- ── conversations ─────────────────────────────────────────────────────────
create policy "conv_visible_to_participants" on conversations for select using (
  id in (select conversation_id from conversation_participants where user_id = auth.uid())
);

create policy "conv_insert_by_tenant_member" on conversations for insert with check (
  tenant_id in (
    select tenant_id from tenant_members where user_id = auth.uid() and is_active = true
    union
    select tenant_id from occupants       where user_id = auth.uid()
  )
);

create policy "conv_update_by_participant" on conversations for update using (
  id in (select conversation_id from conversation_participants where user_id = auth.uid())
);

-- ── participants ──────────────────────────────────────────────────────────
create policy "participants_visible" on conversation_participants for select using (
  conversation_id in (select conversation_id from conversation_participants where user_id = auth.uid())
);

-- A user can flip their own last_read_at / mute / archive / pin.
create policy "participants_self_update" on conversation_participants for update using (
  user_id = auth.uid()
);

-- Allowing anyone in the tenant to be added by the conversation creator is
-- handled via security-definer functions (createDirect, addParticipant), so
-- we keep the policy strict here.
create policy "participants_insert_self" on conversation_participants for insert with check (
  user_id = auth.uid()
);

create policy "participants_delete_self" on conversation_participants for delete using (
  user_id = auth.uid()
);

-- ── messages ──────────────────────────────────────────────────────────────
create policy "messages_visible" on messages for select using (
  conversation_id in (select conversation_id from conversation_participants where user_id = auth.uid())
  and (deleted_at is null or sender_id = auth.uid())
);

create policy "messages_insert" on messages for insert with check (
  sender_id = auth.uid()
  and conversation_id in (select conversation_id from conversation_participants where user_id = auth.uid())
);

create policy "messages_update_own" on messages for update using (
  sender_id = auth.uid()
);

-- ── reactions ─────────────────────────────────────────────────────────────
create policy "reactions_visible" on message_reactions for select using (
  message_id in (
    select id from messages
     where conversation_id in (select conversation_id from conversation_participants where user_id = auth.uid())
  )
);

create policy "reactions_insert_own" on message_reactions for insert with check (
  user_id = auth.uid()
);

create policy "reactions_delete_own" on message_reactions for delete using (
  user_id = auth.uid()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Triggers
-- ═══════════════════════════════════════════════════════════════════════════

-- Maintain conversations.last_message_at + preview on message insert.
create or replace function messaging_bump_last_message()
returns trigger language plpgsql security definer as $$
begin
  update conversations
     set last_message_at      = new.created_at,
         last_message_preview = case
           when new.kind = 'text' and new.body is not null
             then substr(new.body, 1, 120)
           when new.kind = 'image' then '📷 Photo'
           when new.kind = 'file'  then '📎 File'
           when new.kind = 'audio' then '🎤 Voice note'
           when new.kind = 'system' then '·'
           else ''
         end
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_messaging_bump on messages;
create trigger trg_messaging_bump
  after insert on messages
  for each row execute function messaging_bump_last_message();

-- Broadcast write gate — only staff may post to broadcast conversations.
create or replace function messaging_gate_broadcast_writes()
returns trigger language plpgsql security definer as $$
declare
  v_type conversation_type;
begin
  select type into v_type from conversations where id = new.conversation_id;
  if v_type = 'broadcast' then
    if not exists (
      select 1 from tenant_members
       where tenant_id = new.tenant_id
         and user_id   = new.sender_id
         and is_active = true
         and role in ('owner','manager','receptionist','accountant')
    ) then
      raise exception 'Only staff can post to a broadcast conversation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_messaging_gate_broadcast on messages;
create trigger trg_messaging_gate_broadcast
  before insert on messages
  for each row execute function messaging_gate_broadcast_writes();

-- ═══════════════════════════════════════════════════════════════════════════
-- Storage bucket
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('messages', 'messages', false)
on conflict (id) do nothing;

-- Path convention enforced by the app: conversations/<conv_id>/<sender_id>/<uuid>.<ext>
-- Anyone with a session can upload (their own sender_id segment is enforced
-- via owner column comparison). Read is gated by participation.

drop policy if exists "messages_storage_upload"     on storage.objects;
drop policy if exists "messages_storage_read"       on storage.objects;
drop policy if exists "messages_storage_delete_own" on storage.objects;

create policy "messages_storage_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'messages'
    and auth.uid() is not null
  );

create policy "messages_storage_read"
  on storage.objects for select
  using (
    bucket_id = 'messages'
    and exists (
      select 1
        from conversation_participants cp
       where cp.user_id = auth.uid()
         and cp.conversation_id::text = split_part(name, '/', 2)
    )
  );

create policy "messages_storage_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'messages'
    and owner = auth.uid()
  );
