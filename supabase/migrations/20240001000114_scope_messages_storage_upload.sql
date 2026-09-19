-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 114 — Scope messages attachment uploads by conversation
-- participation and lock down the bucket's size/type limits.
--
-- Migration 073 gave the `messages` bucket correct SELECT (participant-only)
-- and DELETE (owner-only) policies, but the INSERT policy only checked
-- `auth.uid() is not null` — any authenticated user could write to any
-- conversation's folder (`conversations/<conv_id>/<sender_id>/<uuid>.<ext>`),
-- regardless of whether they belonged to that conversation. The bucket was
-- also created with no file_size_limit/allowed_mime_types, unlike every
-- other bucket in this schema.
--
-- The app's own upload flow (app/api/messages/attachments/sign/route.ts)
-- already validates participation + mime + size server-side before issuing
-- a signed upload URL, but that only protects callers who go through the
-- app — a direct call to the Storage API with a valid session JWT is
-- authorized purely by this RLS policy, so it needs to enforce the same
-- rules independently.
-- ═══════════════════════════════════════════════════════════════════════════

update storage.buckets
   set file_size_limit    = 15 * 1024 * 1024,  -- matches sign route's max (video/*)
       allowed_mime_types = array['image/*', 'application/pdf', 'audio/*', 'video/*']
 where id = 'messages';

drop policy if exists "messages_storage_upload" on storage.objects;
create policy "messages_storage_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'messages'
    and auth.uid() is not null
    -- path: conversations/<conv_id>/<sender_id>/<uuid>.<ext>
    -- (split_part is 1-indexed and includes the filename as the last field,
    -- matching the existing messages_storage_read policy above)
    and split_part(name, '/', 3) = auth.uid()::text
    and exists (
      select 1
        from conversation_participants cp
       where cp.user_id = auth.uid()
         and cp.conversation_id::text = split_part(name, '/', 2)
    )
  );
