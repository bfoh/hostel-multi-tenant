-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 074 — Auto-add new occupants to the hostel-wide broadcast
--
-- When an occupant is linked to an auth.users row (user_id set), we add
-- them as a participant of the tenant's default broadcast conversation
-- (broadcast_filter IS NULL). The conversation row itself is created on
-- demand by the app the first time staff broadcasts; the trigger is a
-- no-op until then.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function messaging_autojoin_broadcast()
returns trigger language plpgsql security definer as $$
declare
  v_conv_id uuid;
begin
  if new.user_id is null then
    return new;
  end if;

  -- Find the default hostel-wide broadcast conversation, if it exists.
  select id into v_conv_id
    from conversations
   where tenant_id = new.tenant_id
     and type      = 'broadcast'
     and broadcast_filter is null
   limit 1;

  if v_conv_id is null then
    return new;
  end if;

  insert into conversation_participants
    (conversation_id, tenant_id, user_id, participant_kind)
  values
    (v_conv_id, new.tenant_id, new.user_id, 'occupant')
  on conflict (conversation_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_occupant_autojoin_broadcast_insert on occupants;
create trigger trg_occupant_autojoin_broadcast_insert
  after insert on occupants
  for each row execute function messaging_autojoin_broadcast();

drop trigger if exists trg_occupant_autojoin_broadcast_update on occupants;
create trigger trg_occupant_autojoin_broadcast_update
  after update of user_id on occupants
  for each row
  when (old.user_id is distinct from new.user_id and new.user_id is not null)
  execute function messaging_autojoin_broadcast();
