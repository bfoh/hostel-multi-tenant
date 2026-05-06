# Real-Time Issue Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace one-shot `/api/occupant/maintenance` with a threaded real-time conversation between resident and admin, anchored on `maintenance_requests`. Status changes appear inline as system messages. No automated tests (project policy — UAT only).

**Architecture:** New `maintenance_messages` table with realtime publication, RLS-scoped reads, service-role writes via routes. Storage bucket `maintenance-attachments` with private signed URLs. Occupant + staff use shared message bubble + attachment gallery components.

**Tech Stack:** Next.js 16 App Router · React Server Components · Supabase Postgres + Realtime + Storage · Tailwind · TypeScript · lucide-react · Arkesel SMS · Web Push

**Spec:** `docs/superpowers/specs/2026-05-06-real-time-issue-reporting-design.md`

**Testing approach:** No test framework. Each task uses `cd apps/web && npm run type-check` + an explicit manual smoke test. Final task appends a UAT phase to `TESTING.md`.

**Conventions worth knowing:**
- Money in pesewas (not used in this project — kept for cross-project consistency).
- `createAdminClient()` for service-role writes; `await createClient()` for cookie-bound user reads (rare here — most reads go through admin client behind route auth).
- Occupant context via `getOccupantSession()`; staff context via `requireTenantRole(['owner','manager','maintenance'])` from SP 1.
- `booking_payments.status === 'success'` (not `'paid'`) — irrelevant here, but project convention.
- Maintenance status enum: `'open' | 'in_progress' | 'completed' | 'cancelled'`.
- Multipart uploads: parse in route via `request.formData()`. MIME magic-byte sniff helper exists from SP 1 at `lib/upload-validation.ts` (reuse).

---

## File Structure

**New files (16):**

| Path | Responsibility |
|---|---|
| `supabase/migrations/20240001000057_maintenance_messages.sql` | Schema + RLS + trigger + realtime |
| `supabase/migrations/20240001000058_maintenance_attachments_storage.sql` | Storage bucket + policies |
| `apps/web/lib/maintenance/messages.ts` | `getThread`, `insertMessage`, `insertSystemMessage`, recipient resolvers |
| `apps/web/lib/maintenance/attachments.ts` | Validate + upload helper (mirrors SP 1 bank-draft pattern) |
| `apps/web/app/api/occupant/maintenance/[id]/route.ts` | GET request + thread |
| `apps/web/app/api/occupant/maintenance/[id]/messages/route.ts` | POST occupant message |
| `apps/web/app/api/occupant/maintenance/[id]/close/route.ts` | POST close |
| `apps/web/app/api/occupant/maintenance/messages/[messageId]/attachments/[idx]/route.ts` | GET signed URL (occupant) |
| `apps/web/app/api/maintenance/[id]/messages/route.ts` | POST staff message |
| `apps/web/app/api/maintenance/[id]/priority/route.ts` | PATCH priority + system message |
| `apps/web/app/api/maintenance/[id]/reopen/route.ts` | POST reopen |
| `apps/web/app/api/maintenance/messages/[messageId]/attachments/[idx]/route.ts` | GET signed URL (staff) |
| `apps/web/app/(occupant-portal)/occupant-portal/maintenance/[id]/page.tsx` | Occupant detail wrapper |
| `apps/web/components/maintenance/message-bubble.tsx` | Shared message render |
| `apps/web/components/maintenance/attachment-gallery.tsx` | Shared attachment grid |
| `apps/web/components/occupant-portal/maintenance-thread.tsx` | Realtime thread (occupant) |
| `apps/web/components/occupant-portal/maintenance-message-form.tsx` | Occupant compose |
| `apps/web/components/occupant-portal/maintenance-close-button.tsx` | Close confirmation |
| `apps/web/components/maintenance/conversation-view.tsx` | Realtime thread (staff) |
| `apps/web/components/maintenance/staff-message-form.tsx` | Staff compose |
| `apps/web/components/maintenance/priority-bump.tsx` | Priority dropdown |
| `apps/web/components/maintenance/reopen-button.tsx` | Reopen confirmation |

(File count clarification: spec list shows logical components. The "16 new files" header is for routes + helpers + occupant page; the components above bring totals to ~22. Tasks below cover each.)

**Modified files (3):**

| Path | Change |
|---|---|
| `apps/web/app/api/maintenance/[id]/route.ts` | Extend PATCH status to insert system message + dispatch notifications |
| `apps/web/app/(tenant)/maintenance/[id]/page.tsx` | Embed `<ConversationView>` |
| `apps/web/lib/notifications/defaults.ts` | Add 6 maintenance event names + default templates |

**Reused unchanged:**
- `lib/auth/occupant-session.ts`
- `lib/auth/require-tenant-role.ts` (SP 1)
- `lib/upload-validation.ts` (SP 1) — magic-byte sniff
- `lib/sms/dispatch.ts` (SP 1)
- `lib/push/dispatch.ts` (SP 1)

---

## Phase 0 — Worktree setup

### Task 0: Create isolated worktree

**Files:** none.

- [ ] **Step 1: Confirm starting state**

```bash
cd /Users/ebenezerbarning/Desktop/hostels
git status --short
git log --oneline -5
```

Expected: HEAD includes `a581d08 docs(spec): student portal — real-time issue reporting (SP 3)`. Working tree may have unrelated WIP — leave it alone.

- [ ] **Step 2: Enter worktree**

If `EnterWorktree` tool is available: use `name: "feat-realtime-maintenance"`. Otherwise:

```bash
git worktree add .claude/worktrees/feat-realtime-maintenance -b feat/realtime-maintenance
cd .claude/worktrees/feat-realtime-maintenance
```

- [ ] **Step 3: Install deps + baseline type-check**

```bash
npm install --no-audit --no-fund
cd apps/web && npm run type-check
```

Expected: install completes; `tsc --noEmit` exits 0.

If `npm install` fails with `dyld[...]: Library not loaded: ...icu4c/lib/libicui18n.74.dylib`:
```bash
ln -sfn ../Cellar/icu4c/74.2 /usr/local/opt/icu4c
```

- [ ] **Step 4: Copy `.env.local` if needed**

```bash
cp /Users/ebenezerbarning/Desktop/hostels/apps/web/.env.local apps/web/.env.local 2>/dev/null || true
```

---

## Phase 1 — Database & Storage

### Task 1: Migration 057 — Schema

**Files:**
- Create: `supabase/migrations/20240001000057_maintenance_messages.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 057 — Maintenance Messages
-- Threaded conversation per maintenance_request, plus denormalized counters
-- and realtime publication.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Messages table
create table if not exists maintenance_messages (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  request_id      uuid not null references maintenance_requests(id) on delete cascade,
  author_user_id  uuid references auth.users(id) on delete set null,
  author_kind     text not null check (author_kind in ('occupant', 'staff', 'system')),
  body            text check (char_length(coalesce(body, '')) <= 2000),
  attachments     text[] not null default array[]::text[],
  created_at      timestamptz not null default now()
);

create index if not exists idx_mm_request
  on maintenance_messages (tenant_id, request_id, created_at);

create index if not exists idx_mm_tenant_recent
  on maintenance_messages (tenant_id, created_at desc);

-- 2. Denormalized columns on parent
alter table maintenance_requests
  add column if not exists last_message_at timestamptz,
  add column if not exists message_count   int  not null default 0,
  add column if not exists closed_by_kind  text check (closed_by_kind in ('occupant','staff'));

-- 3. Trigger to maintain last_message_at + message_count
create or replace function bump_maintenance_request_on_message()
returns trigger
language plpgsql
security definer
as $$
begin
  update maintenance_requests
     set last_message_at = new.created_at,
         message_count   = message_count + 1
   where id = new.request_id;
  return new;
end;
$$;

drop trigger if exists trg_mm_bump_parent on maintenance_messages;
create trigger trg_mm_bump_parent
  after insert on maintenance_messages
  for each row execute function bump_maintenance_request_on_message();

-- 4. RLS
alter table maintenance_messages enable row level security;

drop policy if exists "occupants read own request messages" on maintenance_messages;
create policy "occupants read own request messages"
  on maintenance_messages for select to authenticated
  using (
    request_id in (
      select mr.id
        from maintenance_requests mr
        join occupants o on o.id = mr.occupant_id
       where o.user_id = auth.uid()
    )
  );

drop policy if exists "staff read tenant messages" on maintenance_messages;
create policy "staff read tenant messages"
  on maintenance_messages for select to authenticated
  using (
    tenant_id in (select tm.tenant_id from tenant_members tm where tm.user_id = auth.uid())
  );

-- (No INSERT/UPDATE/DELETE policies — all writes go through service-role routes.)

-- 5. Realtime publication
alter publication supabase_realtime add table maintenance_messages;
```

- [ ] **Step 2: Apply the migration**

```bash
cd /Users/ebenezerbarning/Desktop/hostels/.claude/worktrees/feat-realtime-maintenance
supabase db push 2>&1 | tail -20
```

Expected: applied without error. If `alter publication ... add table` errors with "relation already in publication", that's fine on re-runs.

- [ ] **Step 3: Verify schema**

```bash
supabase db psql -- -c "\d maintenance_messages"
supabase db psql -- -c "select column_name from information_schema.columns where table_name='maintenance_requests' and column_name in ('last_message_at','message_count','closed_by_kind') order by 1;"
```

Expected: 3 new columns visible.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20240001000057_maintenance_messages.sql
git commit -m "feat(maintenance): migration 057 — message thread schema + realtime"
```

---

### Task 2: Migration 058 — Storage bucket

**Files:**
- Create: `supabase/migrations/20240001000058_maintenance_attachments_storage.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 058 — Maintenance Attachments Bucket
-- Private bucket with signed URL access. Path scheme:
--   <tenant_id>/<request_id>/<message_id>/<filename>
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'maintenance-attachments',
  'maintenance-attachments',
  false,
  5 * 1024 * 1024,
  array[
    'image/jpeg','image/png','image/webp','image/heic','image/heif',
    'application/pdf'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies — only signed-URL access from server. No direct client reads.
-- (Service-role bypasses RLS so route handlers can issue signed URLs.)

drop policy if exists "no direct client read of maintenance attachments" on storage.objects;
create policy "no direct client read of maintenance attachments"
  on storage.objects for select to authenticated
  using (false)  -- server issues signed URLs; clients never read directly
  with check (false);

-- Service-role writes (insert) bypass RLS, so no insert policy needed.
```

- [ ] **Step 2: Apply + verify**

```bash
supabase db push 2>&1 | tail -10
supabase db psql -- -c "select id, public, file_size_limit from storage.buckets where id='maintenance-attachments';"
```

Expected: bucket exists, `public=false`, `file_size_limit=5242880`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20240001000058_maintenance_attachments_storage.sql
git commit -m "feat(maintenance): migration 058 — attachments storage bucket"
```

---

## Phase 2 — Helpers

### Task 3: `lib/maintenance/messages.ts`

**Files:**
- Create: `apps/web/lib/maintenance/messages.ts`

- [ ] **Step 1: Write the file**

```ts
import { createAdminClient } from '@/lib/supabase/admin'

export type AuthorKind = 'occupant' | 'staff' | 'system'

export interface Message {
  id:             string
  request_id:     string
  author_user_id: string | null
  author_kind:    AuthorKind
  body:           string | null
  attachments:    string[]
  created_at:     string
}

export async function getThread(requestId: string, tenantId: string): Promise<Message[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('maintenance_messages')
    .select('id, request_id, author_user_id, author_kind, body, attachments, created_at')
    .eq('tenant_id', tenantId)
    .eq('request_id', requestId)
    .order('created_at', { ascending: true })
    .limit(500)
  if (error) {
    console.error('[maintenance:getThread]', { tenantId, requestId, error })
    return []
  }
  return (data ?? []) as Message[]
}

export async function insertMessage(args: {
  tenantId: string
  requestId: string
  authorUserId: string | null
  authorKind: AuthorKind
  body: string | null
  attachments: string[]
}): Promise<{ id: string } | { error: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('maintenance_messages')
    .insert({
      tenant_id:      args.tenantId,
      request_id:     args.requestId,
      author_user_id: args.authorUserId,
      author_kind:    args.authorKind,
      body:           args.body,
      attachments:    args.attachments,
    })
    .select('id')
    .single()
  if (error) {
    console.error('[maintenance:insertMessage]', error)
    return { error: error.message }
  }
  return { id: data.id }
}

export async function insertSystemMessage(args: {
  tenantId: string
  requestId: string
  body: string
}) {
  return insertMessage({
    tenantId:     args.tenantId,
    requestId:    args.requestId,
    authorUserId: null,
    authorKind:   'system',
    body:         args.body,
    attachments:  [],
  })
}

/** Has staff replied to this request previously? Drives "first reply" notification rule. */
export async function hasPriorStaffMessage(requestId: string, tenantId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { count } = await admin
    .from('maintenance_messages')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('request_id', requestId)
    .eq('author_kind', 'staff')
  return (count ?? 0) > 0
}

/** Has occupant replied since latest staff message? */
export async function isFirstOccupantReplySinceStaff(requestId: string, tenantId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: latestStaff } = await admin
    .from('maintenance_messages')
    .select('created_at')
    .eq('tenant_id', tenantId)
    .eq('request_id', requestId)
    .eq('author_kind', 'staff')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latestStaff) return true // no staff message yet → resident reply is first

  const { count } = await admin
    .from('maintenance_messages')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('request_id', requestId)
    .eq('author_kind', 'occupant')
    .gt('created_at', latestStaff.created_at)
  return (count ?? 0) === 0 // about-to-insert reply is the first since latest staff
}

export async function listMaintenanceStaffUserIds(tenantId: string): Promise<string[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('tenant_members')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .in('role', ['owner', 'manager', 'maintenance'])
  return (data ?? []).map(r => r.user_id as string)
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npm run type-check
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/maintenance/messages.ts
git commit -m "feat(maintenance): message thread helpers"
```

---

### Task 4: `lib/maintenance/attachments.ts`

**Files:**
- Create: `apps/web/lib/maintenance/attachments.ts`

- [ ] **Step 1: Write the file**

```ts
import { createAdminClient } from '@/lib/supabase/admin'
import { sniffMime } from '@/lib/upload-validation'

const MAX_BYTES   = 5 * 1024 * 1024
const MAX_FILES   = 5
const ALLOWED     = new Set([
  'image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf',
])
const BUCKET = 'maintenance-attachments'

export async function uploadAttachments(args: {
  files: File[]
  tenantId: string
  requestId: string
  messageId: string
}): Promise<{ paths: string[] } | { error: string }> {
  if (args.files.length > MAX_FILES) {
    return { error: `Max ${MAX_FILES} files per message` }
  }

  const admin = createAdminClient()
  const paths: string[] = []

  for (const file of args.files) {
    if (file.size > MAX_BYTES) {
      return { error: `${file.name}: exceeds 5 MB` }
    }
    const buf  = Buffer.from(await file.arrayBuffer())
    const mime = await sniffMime(buf, file.type)
    if (!ALLOWED.has(mime)) {
      return { error: `${file.name}: unsupported type ${mime}` }
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
    const path     = `${args.tenantId}/${args.requestId}/${args.messageId}/${safeName}`

    const { error } = await admin.storage.from(BUCKET).upload(path, buf, {
      contentType: mime,
      upsert: false,
    })
    if (error) return { error: `Upload failed: ${error.message}` }
    paths.push(path)
  }

  return { paths }
}

export async function signedUrlFor(path: string, ttlSeconds = 600): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, ttlSeconds)
  if (error || !data) return null
  return data.signedUrl
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npm run type-check
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/maintenance/attachments.ts
git commit -m "feat(maintenance): attachment validation + upload helper"
```

---

## Phase 3 — Occupant routes

### Task 5: `GET /api/occupant/maintenance/[id]`

**Files:**
- Create: `apps/web/app/api/occupant/maintenance/[id]/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { getThread } from '@/lib/maintenance/messages'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin  = createAdminClient()

  const { data: req } = await admin
    .from('maintenance_requests')
    .select('id, tenant_id, occupant_id, status, priority, title, description, created_at, last_message_at, message_count, closed_by_kind, room:rooms(room_number, block)')
    .eq('id', id)
    .eq('tenant_id', session.tenantId)
    .eq('occupant_id', session.occupantId)
    .maybeSingle()

  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const thread = await getThread(id, session.tenantId)
  return NextResponse.json({ request: req, thread })
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npm run type-check
```

- [ ] **Step 3: Commit**

```bash
git add 'apps/web/app/api/occupant/maintenance/[id]/route.ts'
git commit -m "feat(maintenance): GET /api/occupant/maintenance/[id]"
```

---

### Task 6: `POST /api/occupant/maintenance/[id]/messages`

**Files:**
- Create: `apps/web/app/api/occupant/maintenance/[id]/messages/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertMessage, isFirstOccupantReplySinceStaff, listMaintenanceStaffUserIds } from '@/lib/maintenance/messages'
import { uploadAttachments } from '@/lib/maintenance/attachments'
import { dispatchPush } from '@/lib/push/dispatch'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Verify ownership + open booking + request not closed
  const admin = createAdminClient()
  const { data: mr } = await admin
    .from('maintenance_requests')
    .select('id, tenant_id, occupant_id, status, booking_id')
    .eq('id', id)
    .eq('tenant_id', session.tenantId)
    .eq('occupant_id', session.occupantId)
    .maybeSingle()
  if (!mr) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (mr.status === 'completed' || mr.status === 'cancelled') {
    return NextResponse.json({ error: 'Request is closed' }, { status: 409 })
  }
  if (mr.booking_id) {
    const { data: booking } = await admin
      .from('bookings')
      .select('status')
      .eq('id', mr.booking_id)
      .maybeSingle()
    if (booking?.status === 'checked_out') {
      return NextResponse.json({ error: 'Booking checked out' }, { status: 403 })
    }
  }

  const form = await req.formData()
  const body = (form.get('body') as string | null)?.trim() || null
  const files: File[] = []
  for (const v of form.getAll('files')) {
    if (v instanceof File && v.size > 0) files.push(v)
  }
  if (!body && files.length === 0) {
    return NextResponse.json({ error: 'Empty message' }, { status: 400 })
  }
  if (body && body.length > 2000) {
    return NextResponse.json({ error: 'Body exceeds 2000 chars' }, { status: 400 })
  }

  // Compute notification flag BEFORE inserting (so the new row doesn't skew)
  const shouldPing = await isFirstOccupantReplySinceStaff(id, session.tenantId)

  // Pre-compute message id so we can scope storage paths to it
  const messageId = randomUUID()

  let attachmentPaths: string[] = []
  if (files.length > 0) {
    const up = await uploadAttachments({
      files,
      tenantId:  session.tenantId,
      requestId: id,
      messageId,
    })
    if ('error' in up) return NextResponse.json({ error: up.error }, { status: 400 })
    attachmentPaths = up.paths
  }

  const inserted = await admin
    .from('maintenance_messages')
    .insert({
      id:             messageId,
      tenant_id:      session.tenantId,
      request_id:     id,
      author_user_id: session.userId,
      author_kind:    'occupant',
      body,
      attachments:    attachmentPaths,
    })
    .select('id, created_at')
    .single()
  if (inserted.error) {
    return NextResponse.json({ error: inserted.error.message }, { status: 500 })
  }

  // Push to maintenance staff if first reply since latest staff message
  if (shouldPing) {
    const recipients = await listMaintenanceStaffUserIds(session.tenantId)
    if (recipients.length > 0) {
      dispatchPush({
        userIds: recipients,
        title:   `New reply from ${session.firstName}`,
        body:    body ? body.slice(0, 120) : '(attachment)',
        url:     `/maintenance/${id}`,
      }).catch(err => console.error('[occupant message push]', err))
    }
  }

  return NextResponse.json({ id: inserted.data.id, created_at: inserted.data.created_at }, { status: 201 })
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npm run type-check
```

If `dispatchPush` signature differs from above, inspect `lib/push/dispatch.ts` and adapt the call site to match. Don't change the helper.

- [ ] **Step 3: Commit**

```bash
git add 'apps/web/app/api/occupant/maintenance/[id]/messages/route.ts'
git commit -m "feat(maintenance): POST occupant message route"
```

---

### Task 7: `POST /api/occupant/maintenance/[id]/close`

**Files:**
- Create: `apps/web/app/api/occupant/maintenance/[id]/close/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertSystemMessage, listMaintenanceStaffUserIds } from '@/lib/maintenance/messages'
import { dispatchPush } from '@/lib/push/dispatch'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin  = createAdminClient()

  const { data: mr } = await admin
    .from('maintenance_requests')
    .select('id, status')
    .eq('id', id)
    .eq('tenant_id', session.tenantId)
    .eq('occupant_id', session.occupantId)
    .maybeSingle()
  if (!mr) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (mr.status === 'completed' || mr.status === 'cancelled') {
    return NextResponse.json({ error: 'Already closed' }, { status: 409 })
  }

  const upd = await admin
    .from('maintenance_requests')
    .update({ status: 'completed', closed_by_kind: 'occupant' })
    .eq('id', id)
  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 })

  await insertSystemMessage({
    tenantId:  session.tenantId,
    requestId: id,
    body:      `Closed by resident`,
  })

  const recipients = await listMaintenanceStaffUserIds(session.tenantId)
  if (recipients.length > 0) {
    dispatchPush({
      userIds: recipients,
      title:   'Request closed by resident',
      body:    `Maintenance request resolved`,
      url:     `/maintenance/${id}`,
    }).catch(err => console.error('[occupant close push]', err))
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Type-check + commit**

```bash
cd apps/web && npm run type-check
git add 'apps/web/app/api/occupant/maintenance/[id]/close/route.ts'
git commit -m "feat(maintenance): POST occupant close route"
```

---

### Task 8: Occupant signed-URL route

**Files:**
- Create: `apps/web/app/api/occupant/maintenance/messages/[messageId]/attachments/[idx]/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { signedUrlFor } from '@/lib/maintenance/attachments'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ messageId: string; idx: string }> },
) {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messageId, idx } = await params
  const i = Number(idx)
  if (!Number.isFinite(i) || i < 0) return NextResponse.json({ error: 'Bad index' }, { status: 400 })

  const admin = createAdminClient()
  const { data: msg } = await admin
    .from('maintenance_messages')
    .select('attachments, request_id, tenant_id, maintenance_requests:request_id(occupant_id)')
    .eq('id', messageId)
    .eq('tenant_id', session.tenantId)
    .maybeSingle()
  if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Ownership check via the join
  const occId = (Array.isArray((msg as any).maintenance_requests)
    ? (msg as any).maintenance_requests[0]?.occupant_id
    : (msg as any).maintenance_requests?.occupant_id)
  if (occId !== session.occupantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const path = (msg as any).attachments?.[i]
  if (!path) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const url = await signedUrlFor(path)
  if (!url) return NextResponse.json({ error: 'Sign failed' }, { status: 500 })
  return NextResponse.json({ url })
}
```

- [ ] **Step 2: Type-check + commit**

```bash
cd apps/web && npm run type-check
git add 'apps/web/app/api/occupant/maintenance/messages/[messageId]/attachments/[idx]/route.ts'
git commit -m "feat(maintenance): occupant attachment signed-url route"
```

---

## Phase 4 — Staff routes

### Task 9: `POST /api/maintenance/[id]/messages` (staff)

**Files:**
- Create: `apps/web/app/api/maintenance/[id]/messages/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { requireTenantRole } from '@/lib/auth/require-tenant-role'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasPriorStaffMessage } from '@/lib/maintenance/messages'
import { uploadAttachments } from '@/lib/maintenance/attachments'
import { dispatchPush } from '@/lib/push/dispatch'
import { sendSms } from '@/lib/sms/dispatch'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireTenantRole(['owner', 'manager', 'maintenance'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { tenantId, userId } = auth

  const { id } = await params
  const admin = createAdminClient()

  const { data: mr } = await admin
    .from('maintenance_requests')
    .select('id, status, occupant_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!mr) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (mr.status === 'cancelled') return NextResponse.json({ error: 'Cancelled' }, { status: 409 })

  const form = await req.formData()
  const body = (form.get('body') as string | null)?.trim() || null
  const files: File[] = []
  for (const v of form.getAll('files')) if (v instanceof File && v.size > 0) files.push(v)
  if (!body && files.length === 0) return NextResponse.json({ error: 'Empty' }, { status: 400 })
  if (body && body.length > 2000) return NextResponse.json({ error: 'Too long' }, { status: 400 })

  const isFirstStaffMessage = !(await hasPriorStaffMessage(id, tenantId))
  const messageId = randomUUID()

  let attachmentPaths: string[] = []
  if (files.length > 0) {
    const up = await uploadAttachments({ files, tenantId, requestId: id, messageId })
    if ('error' in up) return NextResponse.json({ error: up.error }, { status: 400 })
    attachmentPaths = up.paths
  }

  const inserted = await admin.from('maintenance_messages').insert({
    id:             messageId,
    tenant_id:      tenantId,
    request_id:     id,
    author_user_id: userId,
    author_kind:    'staff',
    body,
    attachments:    attachmentPaths,
  }).select('id, created_at').single()
  if (inserted.error) return NextResponse.json({ error: inserted.error.message }, { status: 500 })

  // Resolve resident contact for push + SMS
  const { data: occ } = await admin
    .from('occupants')
    .select('user_id, phone, first_name')
    .eq('id', mr.occupant_id)
    .maybeSingle()

  if (occ?.user_id) {
    dispatchPush({
      userIds: [occ.user_id],
      title:   isFirstStaffMessage ? 'Reply from hostel staff' : 'New reply',
      body:    body ? body.slice(0, 120) : '(attachment)',
      url:     `/occupant-portal/maintenance/${id}`,
    }).catch(err => console.error('[staff message push]', err))
  }
  if (isFirstStaffMessage && occ?.phone) {
    sendSms({
      tenantId,
      to: occ.phone,
      event: 'maintenance.first_staff_reply',
      vars: { firstName: occ.first_name ?? '', requestId: id.slice(0, 8) },
    }).catch(err => console.error('[staff first-reply sms]', err))
  }

  return NextResponse.json({ id: inserted.data.id, created_at: inserted.data.created_at }, { status: 201 })
}
```

- [ ] **Step 2: Type-check + commit**

```bash
cd apps/web && npm run type-check
git add 'apps/web/app/api/maintenance/[id]/messages/route.ts'
git commit -m "feat(maintenance): POST staff message route"
```

---

### Task 10: Extend `PATCH /api/maintenance/[id]` to insert system message + dispatch

**Files:**
- Modify: `apps/web/app/api/maintenance/[id]/route.ts`

- [ ] **Step 1: Locate the PATCH handler**

```bash
sed -n '1,40p' apps/web/app/api/maintenance/[id]/route.ts
grep -n "status\|priority\|PATCH" apps/web/app/api/maintenance/[id]/route.ts
```

Identify the block where `status` (and possibly `priority`) is updated. Capture the previous value before update.

- [ ] **Step 2: Inject system-message insertion after successful update**

After the existing update, before the response return, add:

```ts
import { insertSystemMessage } from '@/lib/maintenance/messages'
import { dispatchPush } from '@/lib/push/dispatch'
import { sendSms } from '@/lib/sms/dispatch'
// (add to import block at top)

// ... inside PATCH handler, after the update succeeds:

if (typeof body.status === 'string' && body.status !== existing.status) {
  await insertSystemMessage({
    tenantId,
    requestId: id,
    body: `Status changed: ${existing.status} → ${body.status}`,
  })

  const { data: occ } = await admin
    .from('occupants')
    .select('user_id, phone, first_name')
    .eq('id', existing.occupant_id)
    .maybeSingle()
  if (occ?.user_id) {
    dispatchPush({
      userIds: [occ.user_id],
      title:   `Request ${body.status.replace('_', ' ')}`,
      body:    `Status updated by hostel staff`,
      url:     `/occupant-portal/maintenance/${id}`,
    }).catch(err => console.error('[status push]', err))
  }
  if (occ?.phone) {
    sendSms({
      tenantId,
      to: occ.phone,
      event: 'maintenance.status_change',
      vars: { firstName: occ.first_name ?? '', from: existing.status, to: body.status, requestId: id.slice(0, 8) },
    }).catch(err => console.error('[status sms]', err))
  }
}
```

If the existing handler doesn't fetch the row before update (some implementations don't), add a `select('status, occupant_id, ...').eq('id', id).maybeSingle()` call before the update so `existing` is in scope.

- [ ] **Step 3: Type-check + commit**

```bash
cd apps/web && npm run type-check
git add 'apps/web/app/api/maintenance/[id]/route.ts'
git commit -m "feat(maintenance): PATCH status logs system message + notifies"
```

---

### Task 11: `PATCH /api/maintenance/[id]/priority`

**Files:**
- Create: `apps/web/app/api/maintenance/[id]/priority/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { requireTenantRole } from '@/lib/auth/require-tenant-role'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertSystemMessage } from '@/lib/maintenance/messages'
import { dispatchPush } from '@/lib/push/dispatch'

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireTenantRole(['owner', 'manager'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { tenantId } = auth

  const { id } = await params
  const json = await req.json().catch(() => null) as { priority?: string } | null
  if (!json?.priority || !(PRIORITIES as readonly string[]).includes(json.priority)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: mr } = await admin
    .from('maintenance_requests')
    .select('id, priority, occupant_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!mr) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (mr.priority === json.priority) return NextResponse.json({ ok: true, unchanged: true })

  const upd = await admin
    .from('maintenance_requests')
    .update({ priority: json.priority })
    .eq('id', id)
  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 })

  await insertSystemMessage({
    tenantId,
    requestId: id,
    body:      `Priority changed: ${mr.priority} → ${json.priority}`,
  })

  const { data: occ } = await admin
    .from('occupants')
    .select('user_id')
    .eq('id', mr.occupant_id)
    .maybeSingle()
  if (occ?.user_id) {
    dispatchPush({
      userIds: [occ.user_id],
      title:   `Priority: ${json.priority}`,
      body:    `Updated by hostel staff`,
      url:     `/occupant-portal/maintenance/${id}`,
    }).catch(err => console.error('[priority push]', err))
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Type-check + commit**

```bash
cd apps/web && npm run type-check
git add 'apps/web/app/api/maintenance/[id]/priority/route.ts'
git commit -m "feat(maintenance): PATCH priority + system message"
```

---

### Task 12: `POST /api/maintenance/[id]/reopen`

**Files:**
- Create: `apps/web/app/api/maintenance/[id]/reopen/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { requireTenantRole } from '@/lib/auth/require-tenant-role'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertSystemMessage } from '@/lib/maintenance/messages'
import { dispatchPush } from '@/lib/push/dispatch'
import { sendSms } from '@/lib/sms/dispatch'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireTenantRole(['owner', 'manager'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { tenantId } = auth

  const { id } = await params
  const admin = createAdminClient()

  const { data: mr } = await admin
    .from('maintenance_requests')
    .select('id, status, occupant_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!mr) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (mr.status !== 'completed') return NextResponse.json({ error: 'Not closed' }, { status: 409 })

  const upd = await admin
    .from('maintenance_requests')
    .update({ status: 'open', closed_by_kind: null })
    .eq('id', id)
  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 })

  await insertSystemMessage({
    tenantId,
    requestId: id,
    body:      `Reopened by staff`,
  })

  const { data: occ } = await admin
    .from('occupants')
    .select('user_id, phone, first_name')
    .eq('id', mr.occupant_id)
    .maybeSingle()
  if (occ?.user_id) {
    dispatchPush({
      userIds: [occ.user_id],
      title:   'Request reopened',
      body:    'Hostel staff reopened your request',
      url:     `/occupant-portal/maintenance/${id}`,
    }).catch(err => console.error('[reopen push]', err))
  }
  if (occ?.phone) {
    sendSms({
      tenantId,
      to: occ.phone,
      event: 'maintenance.reopened',
      vars: { firstName: occ.first_name ?? '', requestId: id.slice(0, 8) },
    }).catch(err => console.error('[reopen sms]', err))
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Type-check + commit**

```bash
cd apps/web && npm run type-check
git add 'apps/web/app/api/maintenance/[id]/reopen/route.ts'
git commit -m "feat(maintenance): POST reopen route"
```

---

### Task 13: Staff signed-URL route

**Files:**
- Create: `apps/web/app/api/maintenance/messages/[messageId]/attachments/[idx]/route.ts`

- [ ] **Step 1: Write**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { requireTenantRole } from '@/lib/auth/require-tenant-role'
import { createAdminClient } from '@/lib/supabase/admin'
import { signedUrlFor } from '@/lib/maintenance/attachments'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ messageId: string; idx: string }> },
) {
  const auth = await requireTenantRole(['owner', 'manager', 'maintenance', 'receptionist'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { tenantId } = auth

  const { messageId, idx } = await params
  const i = Number(idx)
  if (!Number.isFinite(i) || i < 0) return NextResponse.json({ error: 'Bad index' }, { status: 400 })

  const admin = createAdminClient()
  const { data: msg } = await admin
    .from('maintenance_messages')
    .select('attachments')
    .eq('id', messageId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const path = (msg as any).attachments?.[i]
  if (!path) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const url = await signedUrlFor(path)
  if (!url) return NextResponse.json({ error: 'Sign failed' }, { status: 500 })
  return NextResponse.json({ url })
}
```

- [ ] **Step 2: Type-check + commit**

```bash
cd apps/web && npm run type-check
git add 'apps/web/app/api/maintenance/messages/[messageId]/attachments/[idx]/route.ts'
git commit -m "feat(maintenance): staff attachment signed-url route"
```

---

## Phase 5 — Shared message components

### Task 14: `<AttachmentGallery>`

**Files:**
- Create: `apps/web/components/maintenance/attachment-gallery.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useState } from 'react'
import { FileText, ImageIcon, Loader2 } from 'lucide-react'

interface Props {
  messageId:    string
  attachments:  string[]      // storage paths
  scope:        'occupant' | 'staff'
}

export function AttachmentGallery({ messageId, attachments, scope }: Props) {
  if (attachments.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((path, idx) => (
        <Tile key={idx} messageId={messageId} idx={idx} path={path} scope={scope} />
      ))}
    </div>
  )
}

function Tile({ messageId, idx, path, scope }: { messageId: string; idx: number; path: string; scope: 'occupant'|'staff' }) {
  const [loading, setLoading] = useState(false)
  const filename = path.split('/').pop() ?? 'file'
  const isImage  = /\.(jpe?g|png|webp|heic|heif)$/i.test(filename)

  const open = async () => {
    if (loading) return
    setLoading(true)
    const base = scope === 'occupant'
      ? `/api/occupant/maintenance/messages/${messageId}/attachments/${idx}`
      : `/api/maintenance/messages/${messageId}/attachments/${idx}`
    const res = await fetch(base)
    setLoading(false)
    if (!res.ok) return
    const { url } = await res.json()
    if (url) window.open(url, '_blank', 'noopener')
  }

  return (
    <button
      type="button"
      onClick={open}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : isImage ? <ImageIcon className="h-3.5 w-3.5" />
                        : <FileText  className="h-3.5 w-3.5" />}
      <span className="max-w-[160px] truncate">{filename}</span>
    </button>
  )
}
```

- [ ] **Step 2: Type-check + commit**

```bash
cd apps/web && npm run type-check
git add apps/web/components/maintenance/attachment-gallery.tsx
git commit -m "feat(maintenance): AttachmentGallery shared component"
```

---

### Task 15: `<MessageBubble>`

**Files:**
- Create: `apps/web/components/maintenance/message-bubble.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { AttachmentGallery } from './attachment-gallery'

interface Message {
  id: string
  author_kind: 'occupant' | 'staff' | 'system'
  body: string | null
  attachments: string[]
  created_at: string
}

function timeOf(iso: string) {
  return new Intl.DateTimeFormat('en-GH', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

export function MessageBubble({
  msg, scope, viewerKind,
}: {
  msg: Message
  scope: 'occupant' | 'staff'
  viewerKind: 'occupant' | 'staff'
}) {
  if (msg.author_kind === 'system') {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-slate-100 px-3 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
          {msg.body} · {timeOf(msg.created_at)}
        </span>
      </div>
    )
  }

  const isMine = msg.author_kind === viewerKind
  const align  = isMine ? 'items-end' : 'items-start'
  const bg     = isMine ? 'bg-emerald-600 text-white' : 'bg-white text-slate-900 border border-slate-200'

  return (
    <div className={`flex flex-col ${align}`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${bg}`}>
        {msg.body && <p className="whitespace-pre-wrap break-words">{msg.body}</p>}
        <AttachmentGallery messageId={msg.id} attachments={msg.attachments} scope={scope} />
      </div>
      <span className="mt-0.5 text-[10px] text-slate-400">{timeOf(msg.created_at)}</span>
    </div>
  )
}
```

- [ ] **Step 2: Type-check + commit**

```bash
cd apps/web && npm run type-check
git add apps/web/components/maintenance/message-bubble.tsx
git commit -m "feat(maintenance): MessageBubble shared component"
```

---

## Phase 6 — Occupant UI

### Task 16: `<MaintenanceMessageForm>` (occupant)

**Files:**
- Create: `apps/web/components/occupant-portal/maintenance-message-form.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useState, useRef } from 'react'
import { Send, Paperclip, Loader2, X } from 'lucide-react'

export function MaintenanceMessageForm({
  requestId, color, onSent,
}: {
  requestId: string
  color:     string
  onSent:    () => void
}) {
  const [body, setBody]       = useState('')
  const [files, setFiles]     = useState<File[]>([])
  const [busy, setBusy]       = useState(false)
  const [err, setErr]         = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim() && files.length === 0) return
    setErr(null); setBusy(true)
    const fd = new FormData()
    if (body.trim()) fd.set('body', body.trim())
    files.forEach(f => fd.append('files', f))
    const res = await fetch(`/api/occupant/maintenance/${requestId}/messages`, {
      method: 'POST',
      body:   fd,
    })
    setBusy(false)
    if (!res.ok) {
      const j = await res.json().catch(() => null) as any
      setErr(j?.error ?? 'Send failed')
      return
    }
    setBody('')
    setFiles([])
    if (fileRef.current) fileRef.current.value = ''
    onSent()
  }

  const onPickFiles: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const next = Array.from(e.target.files ?? []).slice(0, 5)
    setFiles(next)
  }

  return (
    <form onSubmit={submit} className="border-t border-slate-200 bg-white p-3">
      {err && <p className="mb-1.5 rounded bg-red-50 px-2 py-1 text-[11px] text-red-700">{err}</p>}
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
              {f.name}
              <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <button type="button" onClick={() => fileRef.current?.click()} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
          <Paperclip className="h-4 w-4" />
        </button>
        <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" hidden onChange={onPickFiles} />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={1}
          maxLength={2000}
          placeholder="Type a message…"
          className="flex-1 resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || (!body.trim() && files.length === 0)}
          className="rounded-full p-2.5 text-white disabled:opacity-50"
          style={{ backgroundColor: color }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Type-check + commit (defer commit to Task 18 bundle)**

```bash
cd apps/web && npm run type-check
```

---

### Task 17: `<MaintenanceCloseButton>`

**Files:**
- Create: `apps/web/components/occupant-portal/maintenance-close-button.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'

export function MaintenanceCloseButton({
  requestId, onClosed,
}: {
  requestId: string
  onClosed:  () => void
}) {
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const close = async () => {
    setBusy(true)
    const res = await fetch(`/api/occupant/maintenance/${requestId}/close`, { method: 'POST' })
    setBusy(false)
    setConfirmOpen(false)
    if (res.ok) onClosed()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        <CheckCircle2 className="h-3.5 w-3.5" /> Mark as resolved
      </button>
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-4" onClick={() => !busy && setConfirmOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900">Close this request?</h3>
            <p className="mt-1 text-sm text-slate-500">Hostel staff can reopen it if you change your mind.</p>
            <div className="mt-4 flex gap-2">
              <button type="button" disabled={busy} onClick={() => setConfirmOpen(false)} className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-700">Cancel</button>
              <button type="button" disabled={busy} onClick={close} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-sm font-bold text-white">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Close request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Type-check (defer commit)**

```bash
cd apps/web && npm run type-check
```

---

### Task 18: `<MaintenanceThread>` (occupant realtime)

**Files:**
- Create: `apps/web/components/occupant-portal/maintenance-thread.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { MessageBubble } from '@/components/maintenance/message-bubble'
import { MaintenanceMessageForm } from './maintenance-message-form'
import { MaintenanceCloseButton } from './maintenance-close-button'

interface Message {
  id: string
  request_id: string
  author_user_id: string | null
  author_kind: 'occupant' | 'staff' | 'system'
  body: string | null
  attachments: string[]
  created_at: string
}

interface Props {
  requestId:        string
  tenantId:         string
  initialThread:    Message[]
  status:           string
  color:            string
}

export function MaintenanceThread({ requestId, tenantId, initialThread, status, color }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialThread)
  const [reqStatus, setReqStatus] = useState<string>(status)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const channel = sb
      .channel(`maintenance-messages:${requestId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'maintenance_messages', filter: `request_id=eq.${requestId}` },
        (payload) => {
          const row = payload.new as Message
          setMessages(prev => prev.find(m => m.id === row.id) ? prev : [...prev, row])
        },
      )
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [requestId, tenantId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const isClosed = reqStatus === 'completed' || reqStatus === 'cancelled'

  return (
    <div className="flex h-[calc(100vh-220px)] flex-col rounded-2xl border border-slate-200 bg-slate-50">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0
          ? <p className="py-10 text-center text-xs text-slate-400">No messages yet.</p>
          : messages.map(m => <MessageBubble key={m.id} msg={m} scope="occupant" viewerKind="occupant" />)}
        <div ref={bottomRef} />
      </div>

      {!isClosed && reqStatus === 'in_progress' && (
        <div className="border-t border-slate-200 bg-white px-3 py-2 text-right">
          <MaintenanceCloseButton requestId={requestId} onClosed={() => setReqStatus('completed')} />
        </div>
      )}

      {isClosed
        ? <p className="border-t border-slate-200 bg-white px-3 py-3 text-center text-[11px] text-slate-400">Request closed. Reopen via hostel staff.</p>
        : <MaintenanceMessageForm requestId={requestId} color={color} onSent={() => { /* realtime will deliver */ }} />}
    </div>
  )
}
```

- [ ] **Step 2: Type-check + bundle commit**

```bash
cd apps/web && npm run type-check
git add apps/web/components/occupant-portal/maintenance-message-form.tsx \
        apps/web/components/occupant-portal/maintenance-close-button.tsx \
        apps/web/components/occupant-portal/maintenance-thread.tsx
git commit -m "feat(maintenance): occupant thread + form + close components"
```

---

### Task 19: Occupant detail page

**Files:**
- Create: `apps/web/app/(occupant-portal)/occupant-portal/maintenance/[id]/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { getOccupantSession } from '@/lib/auth/occupant-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { getThread } from '@/lib/maintenance/messages'
import { MaintenanceThread } from '@/components/occupant-portal/maintenance-thread'

export const metadata: Metadata = { title: 'Request · My Portal' }

const STATUS: Record<string, string> = {
  open:        'bg-amber-50 text-amber-700 border-amber-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  completed:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled:   'bg-slate-100 text-slate-600 border-slate-200',
}

export default async function OccupantMaintenanceDetail({
  params,
}: { params: Promise<{ id: string }> }) {
  const session = await getOccupantSession()
  if (!session) redirect('/login')

  const { id } = await params
  const admin = createAdminClient()

  const { data: req } = await admin
    .from('maintenance_requests')
    .select('id, status, priority, title, description, created_at, room:rooms(room_number, block)')
    .eq('id', id)
    .eq('tenant_id', session.tenantId)
    .eq('occupant_id', session.occupantId)
    .maybeSingle()
  if (!req) notFound()

  const thread = await getThread(id, session.tenantId)
  const room   = Array.isArray((req as any).room) ? (req as any).room[0] : (req as any).room

  return (
    <div className="space-y-3">
      <Link href="/occupant-portal/maintenance" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Link>

      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-900">{(req as any).title}</h1>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Room {room?.room_number ?? '—'}{room?.block ? ` · ${room.block}` : ''}
            </p>
          </div>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS[(req as any).status] ?? STATUS.open}`}>
            {(req as any).status.replace('_', ' ')}
          </span>
        </div>
        {(req as any).description && (
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{(req as any).description}</p>
        )}
      </header>

      <MaintenanceThread
        requestId={id}
        tenantId={session.tenantId}
        initialThread={thread}
        status={(req as any).status}
        color={session.tenantColor}
      />
    </div>
  )
}
```

- [ ] **Step 2: Type-check + commit**

```bash
cd apps/web && npm run type-check
git add 'apps/web/app/(occupant-portal)/occupant-portal/maintenance/[id]/page.tsx'
git commit -m "feat(maintenance): occupant request detail page"
```

---

### Task 20: Wire maintenance list → detail link

**Files:**
- Modify: `apps/web/app/(occupant-portal)/occupant-portal/maintenance/page.tsx`

- [ ] **Step 1: Locate row render**

```bash
grep -n "maintenance_requests\|map\|<li\|<Link" 'apps/web/app/(occupant-portal)/occupant-portal/maintenance/page.tsx' | head -10
```

- [ ] **Step 2: Wrap each request row in `<Link href={"/occupant-portal/maintenance/${r.id}"}>`**

If rows are currently rendered as `<li>` or `<div>`, replace the wrapper with `<Link>` (from `next/link`). Preserve all child markup. If a `<Link>` is already present, ensure it points at `/occupant-portal/maintenance/${r.id}` (not `/occupant-portal/maintenance/new` or similar).

- [ ] **Step 3: Type-check + commit**

```bash
cd apps/web && npm run type-check
git add 'apps/web/app/(occupant-portal)/occupant-portal/maintenance/page.tsx'
git commit -m "feat(maintenance): list rows link to detail page"
```

---

## Phase 7 — Staff UI

### Task 21: `<StaffMessageForm>`

**Files:**
- Create: `apps/web/components/maintenance/staff-message-form.tsx`

- [ ] **Step 1: Write the component**

(Identical shape to occupant form but POSTs to staff route. Color uses tenant brand color or fallback.)

```tsx
'use client'

import { useState, useRef } from 'react'
import { Send, Paperclip, Loader2, X } from 'lucide-react'

export function StaffMessageForm({
  requestId, onSent,
}: {
  requestId: string
  onSent:    () => void
}) {
  const [body, setBody]   = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim() && files.length === 0) return
    setErr(null); setBusy(true)
    const fd = new FormData()
    if (body.trim()) fd.set('body', body.trim())
    files.forEach(f => fd.append('files', f))
    const res = await fetch(`/api/maintenance/${requestId}/messages`, { method: 'POST', body: fd })
    setBusy(false)
    if (!res.ok) {
      const j = await res.json().catch(() => null) as any
      setErr(j?.error ?? 'Send failed'); return
    }
    setBody(''); setFiles([])
    if (fileRef.current) fileRef.current.value = ''
    onSent()
  }

  const onPickFiles: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    setFiles(Array.from(e.target.files ?? []).slice(0, 5))
  }

  return (
    <form onSubmit={submit} className="border-t border-slate-200 bg-white p-3">
      {err && <p className="mb-1.5 rounded bg-red-50 px-2 py-1 text-[11px] text-red-700">{err}</p>}
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
              {f.name}
              <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <button type="button" onClick={() => fileRef.current?.click()} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
          <Paperclip className="h-4 w-4" />
        </button>
        <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" hidden onChange={onPickFiles} />
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={1} maxLength={2000}
          placeholder="Reply to resident…"
          className="flex-1 resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
        <button type="submit" disabled={busy || (!body.trim() && files.length === 0)}
          className="rounded-full bg-emerald-600 p-2.5 text-white disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Type-check + commit**

```bash
cd apps/web && npm run type-check
git add apps/web/components/maintenance/staff-message-form.tsx
git commit -m "feat(maintenance): StaffMessageForm component"
```

---

### Task 22: `<PriorityBump>` and `<ReopenButton>`

**Files:**
- Create: `apps/web/components/maintenance/priority-bump.tsx`
- Create: `apps/web/components/maintenance/reopen-button.tsx`

- [ ] **Step 1: Write priority-bump.tsx**

```tsx
'use client'

import { useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
type P = typeof PRIORITIES[number]

const COLOR: Record<P, string> = {
  low:    'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high:   'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
}

export function PriorityBump({
  requestId, current, onChange,
}: {
  requestId: string
  current:   P
  onChange:  (next: P) => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const set = async (next: P) => {
    if (next === current) { setOpen(false); return }
    setBusy(true)
    const res = await fetch(`/api/maintenance/${requestId}/priority`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: next }),
    })
    setBusy(false)
    setOpen(false)
    if (res.ok) onChange(next)
  }

  return (
    <div className="relative inline-block">
      <button type="button" onClick={() => setOpen(!open)} disabled={busy}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ${COLOR[current]}`}>
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : current}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-32 rounded-lg border border-slate-200 bg-white shadow-lg">
          {PRIORITIES.map(p => (
            <button key={p} type="button" onClick={() => set(p)}
              className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 ${p === current ? 'font-bold' : ''}`}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write reopen-button.tsx**

```tsx
'use client'

import { useState } from 'react'
import { RotateCcw, Loader2 } from 'lucide-react'

export function ReopenButton({ requestId, onReopened }: { requestId: string; onReopened: () => void }) {
  const [busy, setBusy] = useState(false)
  const click = async () => {
    setBusy(true)
    const res = await fetch(`/api/maintenance/${requestId}/reopen`, { method: 'POST' })
    setBusy(false)
    if (res.ok) onReopened()
  }
  return (
    <button type="button" onClick={click} disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
      Reopen
    </button>
  )
}
```

- [ ] **Step 3: Type-check + commit**

```bash
cd apps/web && npm run type-check
git add apps/web/components/maintenance/priority-bump.tsx apps/web/components/maintenance/reopen-button.tsx
git commit -m "feat(maintenance): priority + reopen action components"
```

---

### Task 23: `<ConversationView>` (staff-side realtime)

**Files:**
- Create: `apps/web/components/maintenance/conversation-view.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { MessageBubble } from './message-bubble'
import { StaffMessageForm } from './staff-message-form'
import { ReopenButton } from './reopen-button'

interface Message {
  id: string
  request_id: string
  author_user_id: string | null
  author_kind: 'occupant' | 'staff' | 'system'
  body: string | null
  attachments: string[]
  created_at: string
}

export function ConversationView({
  requestId, tenantId, initialThread, initialStatus,
}: {
  requestId: string
  tenantId:  string
  initialThread: Message[]
  initialStatus: string
}) {
  const [messages, setMessages] = useState<Message[]>(initialThread)
  const [status, setStatus]     = useState<string>(initialStatus)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const ch = sb.channel(`maintenance-messages:${requestId}`)
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'maintenance_messages', filter: `request_id=eq.${requestId}` },
          (p) => {
            const row = p.new as Message
            setMessages(prev => prev.find(m => m.id === row.id) ? prev : [...prev, row])
          })
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [requestId, tenantId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  const isClosed = status === 'completed' || status === 'cancelled'

  return (
    <div className="flex h-[600px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <h3 className="text-sm font-semibold text-slate-700">Conversation</h3>
        {isClosed && <ReopenButton requestId={requestId} onReopened={() => setStatus('open')} />}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0
          ? <p className="py-10 text-center text-xs text-slate-400">No messages yet.</p>
          : messages.map(m => <MessageBubble key={m.id} msg={m} scope="staff" viewerKind="staff" />)}
        <div ref={bottomRef} />
      </div>
      {!isClosed && <StaffMessageForm requestId={requestId} onSent={() => {}} />}
    </div>
  )
}
```

- [ ] **Step 2: Type-check + commit**

```bash
cd apps/web && npm run type-check
git add apps/web/components/maintenance/conversation-view.tsx
git commit -m "feat(maintenance): ConversationView staff-side realtime"
```

---

### Task 24: Embed `<ConversationView>` in tenant detail page

**Files:**
- Modify: `apps/web/app/(tenant)/maintenance/[id]/page.tsx`

- [ ] **Step 1: Locate insertion point**

```bash
sed -n '1,40p' 'apps/web/app/(tenant)/maintenance/[id]/page.tsx'
```

Find where the existing detail page renders summary/contractor info. The conversation should be added after the summary card but before contractor/note sections.

- [ ] **Step 2: Fetch thread + render component**

Add to imports:
```tsx
import { getThread } from '@/lib/maintenance/messages'
import { ConversationView } from '@/components/maintenance/conversation-view'
import { PriorityBump } from '@/components/maintenance/priority-bump'
```

Inside the page component (after the existing request fetch resolves with `req`):
```tsx
const thread = await getThread(req.id, req.tenant_id)
```

Render in the JSX where appropriate:
```tsx
<ConversationView
  requestId={req.id}
  tenantId={req.tenant_id}
  initialThread={thread}
  initialStatus={req.status}
/>
```

If a priority badge currently sits in the header, replace it with `<PriorityBump current={req.priority} requestId={req.id} onChange={() => {}} />` (client wrapper if needed).

- [ ] **Step 3: Type-check + commit**

```bash
cd apps/web && npm run type-check
git add 'apps/web/app/(tenant)/maintenance/[id]/page.tsx'
git commit -m "feat(maintenance): embed conversation view on tenant detail"
```

---

## Phase 8 — Notification templates

### Task 25: SMS templates + event names

**Files:**
- Modify: `apps/web/lib/notifications/defaults.ts`

- [ ] **Step 1: Locate the events array**

```bash
sed -n '1,40p' apps/web/lib/notifications/defaults.ts
```

- [ ] **Step 2: Add 5 maintenance events**

In the events list / template map, add:

```ts
'maintenance.first_staff_reply': {
  label: 'Maintenance — first staff reply',
  smsTemplate: 'Hi {{firstName}}, hostel staff replied to your request {{requestId}}. Open the portal to view.',
},
'maintenance.status_change': {
  label: 'Maintenance — status change',
  smsTemplate: 'Hi {{firstName}}, your request {{requestId}} moved from {{from}} to {{to}}.',
},
'maintenance.reopened': {
  label: 'Maintenance — reopened',
  smsTemplate: 'Hi {{firstName}}, hostel staff reopened request {{requestId}}.',
},
```

(Match the exact shape of existing entries. If templates use different placeholder syntax, adapt.)

- [ ] **Step 3: Type-check + commit**

```bash
cd apps/web && npm run type-check
git add apps/web/lib/notifications/defaults.ts
git commit -m "feat(maintenance): SMS templates for thread events"
```

---

## Phase 9 — Documentation & PR

### Task 26: TESTING.md UAT phase

**Files:**
- Modify: `TESTING.md`

- [ ] **Step 1: Append UAT phase**

```bash
cat >> TESTING.md <<'EOF'

---

## Phase — Real-Time Issue Reporting

Pre-requisites:
- Test occupant logged in with at least one open `maintenance_request`.
- A staff account with `maintenance` or `manager` role for replies.

### Threading

- [ ] Occupant `/occupant-portal/maintenance/[id]` loads with empty thread (or pre-existing messages if seed exists).
- [ ] Occupant sends text message → appears in thread within <1s on staff `/maintenance/[id]` view.
- [ ] Staff replies → appears in occupant view in <1s without page refresh.
- [ ] Both sides see attachments rendered as filename pills; clicking opens signed URL in new tab.
- [ ] Body > 2000 chars rejected with error toast.
- [ ] >5 files in single message rejected.
- [ ] File >5 MB rejected.
- [ ] Wrong MIME (e.g. .exe renamed .pdf) rejected by sniff.

### System messages

- [ ] Staff changes status open → in_progress → system message renders centered as pill in both views.
- [ ] Status change triggers occupant push notification.
- [ ] Status change sends SMS to occupant phone (if Arkesel configured).
- [ ] Admin priority bump renders system message; push (no SMS) to occupant.
- [ ] Resident clicks "Mark as resolved" → confirmation modal → confirms → status flips to completed; system message logged; staff get push.
- [ ] Admin reopens completed request → status back to open; system message; resident gets push + SMS.

### Notification volume

- [ ] First-ever staff reply: occupant push + SMS.
- [ ] Subsequent staff replies: push only (no SMS).
- [ ] First occupant reply since latest staff message: staff push to all maintenance staff.
- [ ] Subsequent occupant replies (before staff replies again): no staff push.

### Auth & access

- [ ] Direct GET to `/occupant-portal/maintenance/<another-occupant's-request>` → 404.
- [ ] Direct POST to `/api/occupant/maintenance/<another-occupant's-id>/messages` → 404.
- [ ] Logged-out user → redirect to /login.
- [ ] Receptionist role → no access to `/maintenance/[id]/priority` PATCH (403).
- [ ] Resident on a checked-out booking → POST messages returns 403.
- [ ] Closed request: occupant POST → 409.

### Realtime resilience

- [ ] Disconnect network for 30s → reconnect → in-flight messages from staff still appear when reconnected.
- [ ] Two browser tabs open → message in tab A appears in tab B within 1s.
EOF
echo "appended TESTING.md"
```

- [ ] **Step 2: Commit**

```bash
git add TESTING.md
git commit -m "docs(testing): real-time issue reporting UAT phase"
```

---

### Task 27: Build smoke test

**Files:** none

- [ ] **Step 1: Build**

```bash
cd apps/web && npm run build 2>&1 | tail -30
```

Expected: build succeeds. New routes appear in the route list:
- `/api/occupant/maintenance/[id]`
- `/api/occupant/maintenance/[id]/messages`
- `/api/occupant/maintenance/[id]/close`
- `/api/occupant/maintenance/messages/[messageId]/attachments/[idx]`
- `/api/maintenance/[id]/messages`
- `/api/maintenance/[id]/priority`
- `/api/maintenance/[id]/reopen`
- `/api/maintenance/messages/[messageId]/attachments/[idx]`
- `/occupant-portal/maintenance/[id]`

If build fails, capture the error and either fix in scope or file a follow-up.

---

### Task 28: Open the PR

**Files:** none

- [ ] **Step 1: Push branch**

```bash
git push -u origin $(git branch --show-current)
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat: real-time maintenance issue reporting (sub-project 3 of 4)" --body "$(cat <<'EOF'
## Summary

- Threaded real-time maintenance conversations between resident and admin
- New `maintenance_messages` table with realtime publication
- New `maintenance-attachments` storage bucket (private, signed URLs only)
- System messages on status / priority / reopen / close events
- Push + SMS notifications gated by sensible "first reply" rules to keep noise down

## Spec & roadmap

- Spec: `docs/superpowers/specs/2026-05-06-real-time-issue-reporting-design.md`
- Plan: `docs/superpowers/plans/2026-05-06-real-time-issue-reporting.md`
- Roadmap: `docs/superpowers/2026-05-05-sub-projects-2-4-roadmap.md`

## Migrations

- `20240001000057_maintenance_messages.sql` — schema + RLS + trigger + realtime publication
- `20240001000058_maintenance_attachments_storage.sql` — bucket + size/MIME limits

## What's NOT in this PR

- Internal admin-only notes
- Per-tenant SMS frequency preferences
- File thumbnailing pipeline
- Anonymous reporting flow
- Threaded sub-replies
- Read receipts

## Test plan

See `TESTING.md` → **Phase — Real-Time Issue Reporting** for the full UAT checklist.
EOF
)"
```

- [ ] **Step 3: Surface PR URL.**

---

## Self-review notes (for the implementing engineer)

- **No automated tests** — same project policy as SP 1 + SP 2. Manual UAT in TESTING.md is the QA artifact.
- **`(any)` casts** likely needed for the maintenance_request fetch on the occupant detail page until Supabase types are regenerated. Match SP 2 pattern.
- **Realtime RLS:** the channel filter is server-side. RLS policies determine which rows the client receives. Both sides see all message rows for a given request_id; staff side intentionally sees occupant messages (and vice versa) since they're peers in the conversation.
- **Trigger race on `message_count`:** `update ... set message_count = message_count + 1` is atomic at the row level. PG handles the increment correctly under concurrent inserts.
- **Push + SMS dispatch** are fire-and-forget (`.catch(...)`) so a failing notification doesn't block the message insert.
- **Storage path** scopes by `tenant_id/request_id/message_id/filename`. RLS on `storage.objects` is `using (false)` — clients never read directly; signed URLs from server only.
- **First-staff-reply detection** uses `count(...)` which does an index scan on `(tenant_id, request_id, author_kind)` — cheap. Don't try to cache.
- **Channel-per-request** scales to ~1k concurrent open conversations. Beyond that, switch to per-tenant channel filtered by `request_id` (one-line client change).
- **Bottom-nav already has "Requests" tab** linking to `/occupant-portal/maintenance` — no nav changes needed.
