# Real-Time Issue Reporting — Design Spec

**Sub-project 3 of 4** — Roadmap: `docs/superpowers/2026-05-05-sub-projects-2-4-roadmap.md`

**Date:** 2026-05-06

**Goal:** Replace the current one-shot `POST /api/occupant/maintenance` with a threaded, real-time conversation between resident and admin, anchored on a maintenance request. Both sides see updates live; status changes appear inline as system messages.

**Non-goals (initial scope):**
- Voice / video messages
- Read receipts
- @mentions
- Internal admin-only notes
- Knowledge base / canned responses
- Anonymous reports
- Former-occupant access (hard cutoff at checkout)

---

## Locked decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Reply model | Flat list of messages on a request |
| 2 | Status changes | System messages inline (and badge) |
| 3 | Photo attachments | ≤ 5 per message, 5 MB each, image + PDF |
| 4 | Push notifications | Initial submission + status change + first staff response only |
| 5 | SMS notifications | Status change + first staff response only |
| 6 | Resident close/reopen | Resident closes own; admin-only reopen |
| 7 | Priority escalation | Admin only; bump triggers push to resident, no SMS |
| 8 | Former occupants | Hard cutoff at checkout |
| 9 | Anonymous reports | Out of scope |
| 10 | Multi-tenant | One hostel per tenant — no change |

---

## Architecture overview

### New table: `maintenance_messages`

```sql
create table maintenance_messages (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  request_id      uuid not null references maintenance_requests(id) on delete cascade,
  author_user_id  uuid references auth.users(id) on delete set null,
  author_kind     text not null check (author_kind in ('occupant', 'staff', 'system')),
  body            text check (char_length(coalesce(body, '')) <= 2000),
  attachments     text[] not null default array[]::text[],   -- storage object paths
  created_at      timestamptz not null default now()
);

create index idx_maintenance_messages_request on maintenance_messages (tenant_id, request_id, created_at);
create index idx_maintenance_messages_tenant_recent on maintenance_messages (tenant_id, created_at desc);
```

**Constraint:** body OR attachments must be non-empty. Enforced at route layer (cheap; trigger overkill).

**System messages:** `author_kind = 'system'`, `author_user_id` null, `body` is the system event text (e.g. `"Status changed: open → in_progress"`, `"Priority bumped: medium → high"`, `"Closed by resident"`).

### Maintenance request extension

```sql
alter table maintenance_requests
  add column if not exists last_message_at timestamptz,
  add column if not exists message_count int not null default 0,
  add column if not exists closed_by_kind text check (closed_by_kind in ('occupant', 'staff'));
```

`last_message_at` + `message_count` are denormalized for sort/list rendering. Maintained by an AFTER INSERT trigger on `maintenance_messages`.

### RLS

```sql
alter table maintenance_messages enable row level security;

-- Occupant SELECT: only messages on their own requests
create policy "occupants read own request messages"
  on maintenance_messages for select to authenticated
  using (
    request_id in (
      select id from maintenance_requests mr
       where mr.occupant_id = (select occupant_id from occupants where user_id = auth.uid() limit 1)
    )
  );

-- Staff SELECT: tenant scope
create policy "staff read tenant messages"
  on maintenance_messages for select to authenticated
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );

-- Inserts go through routes (service role); no INSERT policy.
```

### Realtime publication

```sql
alter publication supabase_realtime add table maintenance_messages;
```

Client subscribes to channel `maintenance-messages:<request_id>` filtered server-side via RLS. Both sides use the same channel — staff sees occupant messages live, occupant sees staff replies + status system messages live.

### Storage bucket: `maintenance-attachments`

- Private bucket (no public read).
- Allowlisted MIME: `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `application/pdf`.
- Max 5 MB per file.
- Path scheme: `<tenant_id>/<request_id>/<message_id>/<filename>`.
- Storage policies mirror SP 1 bank-drafts: tenant staff read all in tenant; occupant reads only own messages' files.
- Signed URLs (10-minute TTL) issued by GET route.

---

## API surface

### Occupant routes

| Verb | Path | Behavior |
|---|---|---|
| `GET` | `/api/occupant/maintenance/[id]` | Fetch request + thread (paged at 100 most recent, ascending). Returns 404 if request not owned by current occupant. |
| `POST` | `/api/occupant/maintenance/[id]/messages` | Multipart form (body + up to 5 files). Inserts message + uploads attachments. Triggers admin push if first reply since admin assignment. |
| `POST` | `/api/occupant/maintenance/[id]/close` | Sets request `status = 'completed'`, `closed_by_kind = 'occupant'`. Inserts system message. |
| `GET` | `/api/occupant/maintenance/messages/[messageId]/attachments/[idx]` | Returns short-lived signed URL for one attachment after ownership check. |

### Staff routes

| Verb | Path | Behavior |
|---|---|---|
| `POST` | `/api/maintenance/[id]/messages` | Same as occupant POST but staff-side. First staff message triggers resident push + SMS. |
| `PATCH` | `/api/maintenance/[id]/status` | **Existing route — extended.** Inserts system message on status change. Triggers resident push + SMS. |
| `PATCH` | `/api/maintenance/[id]/priority` | New. Admin-only. Inserts system message. Push (no SMS) to resident. |
| `POST` | `/api/maintenance/[id]/reopen` | Admin-only. Sets status back to `open`. System message. Push to resident. |
| `GET` | `/api/maintenance/messages/[messageId]/attachments/[idx]` | Signed URL, staff scoped. |

All write routes use `requireTenantRole()` for staff and `getOccupantSession()` for occupant — same pattern as SP 1.

---

## Components

### Occupant side

| Path | Type | Responsibility |
|---|---|---|
| `app/(occupant-portal)/occupant-portal/maintenance/[id]/page.tsx` | Server | Fetch request + initial thread, render header + `<MaintenanceThread>` |
| `components/occupant-portal/maintenance-thread.tsx` | Client | Realtime subscription, message list, calls into form + `<AttachmentGallery>` |
| `components/occupant-portal/maintenance-message-form.tsx` | Client | Body textarea + file input (≤5 files), POST handler with optimistic add |
| `components/occupant-portal/maintenance-close-button.tsx` | Client | Confirmation modal → POST close |

### Staff side

| Path | Type | Responsibility |
|---|---|---|
| `components/maintenance/conversation-view.tsx` | Client | Realtime thread embed for `/(tenant)/maintenance/[id]/page.tsx`. Same shape as occupant view but with staff styling. |
| `components/maintenance/staff-message-form.tsx` | Client | Same as occupant form, staff-side actions |
| `components/maintenance/priority-bump.tsx` | Client | Inline priority dropdown that calls PATCH `/priority` |
| `components/maintenance/reopen-button.tsx` | Client | Confirmation → POST `/reopen` |

### Shared

| Path | Type | Responsibility |
|---|---|---|
| `components/maintenance/message-bubble.tsx` | Client | One message render: avatar/name, body, attachments, timestamp. Switches style by `author_kind`. |
| `components/maintenance/attachment-gallery.tsx` | Client | Grid of thumbnails (image) + filename pills (PDF). Click → fetch signed URL → open in new tab. |
| `lib/maintenance/messages.ts` | Server | `getThread(requestId, scope)`, `insertMessage(...)`, `insertSystemMessage(...)`, `validateAttachments(...)`. Mirrors `lib/bank-draft.ts`. |

---

## Data flow — happy path

1. Resident opens `/occupant-portal/maintenance/[id]` → page server-fetches request + last 100 messages.
2. `<MaintenanceThread>` mounts → subscribes to `maintenance-messages:<request_id>` via Supabase realtime.
3. Resident types message + selects 1 photo → submits form → `POST /api/occupant/maintenance/[id]/messages` (multipart).
4. Route validates session + ownership → uploads attachment to bucket → inserts `maintenance_messages` row → trigger updates `last_message_at` + `message_count` on parent.
5. Realtime broadcast → staff browsers viewing the conversation receive the row → optimistic UI on resident side reconciles.
6. If first occupant reply since assignment, dispatch push notification to assigned staff (if applicable) — Phase 2 fanout to all maintenance staff if no assignment.
7. Staff replies similarly → resident receives push + SMS (first reply rule), then push only for subsequent.

## Data flow — status change

1. Staff changes status in tenant detail page → `PATCH /api/maintenance/[id]/status`.
2. Route updates `maintenance_requests.status` and inserts a system message in the same Supabase RPC (or sequential service-role calls; ordering: status update first, then system message — never the reverse, so the realtime stream can never deliver a status pill before the row update lands).
3. System message body: `Status changed: open → in_progress` with `author_kind = 'system'`. Status enum values from `maintenance_requests.status`: `'open' | 'in_progress' | 'completed' | 'cancelled'`.
4. Realtime broadcast picks up the system message; both sides render it inline as a centered status pill row.
5. Resident push + SMS dispatched.

## Notification matrix

| Event | Push to resident | SMS to resident | Push to staff | SMS to staff |
|---|---|---|---|---|
| Initial submission | — | — | ✓ (all maintenance staff) | ✗ (config-gated v2) |
| First staff reply on request (lifetime) | ✓ | ✓ | — | — |
| Subsequent staff reply | ✓ | ✗ | — | — |
| Resident reply (first since latest staff message) | — | — | ✓ (assignee if set, else all maintenance staff) | ✗ |
| Resident reply (subsequent before staff replies again) | — | — | ✗ | ✗ |
| Status change | ✓ | ✓ | — | — |
| Priority bump | ✓ | ✗ | — | — |
| Resident close | — | — | ✓ | ✗ |
| Admin reopen | ✓ | ✓ | — | — |

SMS templates added to `lib/notifications/defaults.ts`. Push uses existing infra from SP 1. "Maintenance staff" recipients = `tenant_members.role in ('owner', 'manager', 'maintenance')`.

---

## Validation rules

- **Body:** trimmed; max 2000 chars; required if no attachments.
- **Attachments:** max 5 per message; each ≤ 5 MB; MIME allowlist enforced server-side via magic-byte sniff (already present from bank-drafts).
- **Author check:** `author_kind` derived server-side from session — never client-supplied.
- **Closed requests:** new messages rejected (409) unless admin reopens. System messages still allowed.
- **Former occupants:** if `bookings.status = 'checked_out'` for the booking tied to the request → reject occupant POSTs with 403.

---

## Migration list (1)

`20240001000057_maintenance_messages.sql`:
- `create table maintenance_messages` + indexes
- `alter table maintenance_requests` for the 3 new columns
- AFTER INSERT trigger maintaining `last_message_at` + `message_count`
- RLS policies (occupant read, staff read)
- Realtime publication addition
- Storage bucket policies (in same migration to keep atomic, mirroring SP 1)

`20240001000058_maintenance_attachments_storage.sql` — storage bucket creation + MIME/size limits + bucket-level policies.

(Two migrations matches SP 1 split: schema vs storage.)

---

## Settings

No tenant settings for v1. SMS frequency knob + push toggle deferred to Phase 2.

---

## Out of scope (for SP 4 or beyond)

- Internal admin-only notes
- Per-tenant SMS frequency preferences
- File thumbnailing pipeline
- Anonymous reporting flow
- Threaded sub-replies
- Read receipts
- Voice/video
- Knowledge base linking

---

## Risks

- **Channel scaling:** one realtime channel per request. At ~100 concurrent open requests this is fine. If usage grows past 1k concurrent, switch to per-tenant channel filtered by request_id (one-line change client-side).
- **Notification noise:** decisions 4 + 5 cap volume. Watch SMS spend in week 1 of launch.
- **Trigger race:** two parallel inserts on the same request could double-update `message_count`. Use `update ... set message_count = message_count + 1` inside trigger to avoid the race.
- **Attachment storage growth:** 5 MB × 5 files × thousands of messages = real money. Lifecycle policy to expire attachments after 1 year (closed requests) — Phase 2.
- **Cancelled-booking trigger interaction:** SP 1 added a trigger that flips bank drafts to `failed` on booking cancellation. Maintenance requests have no equivalent — confirm by spec that cancelling a booking does NOT touch maintenance threads (resident may still need to escalate).

---

## UAT outline (deferred to plan)

- Listing page already exists at `/occupant-portal/maintenance`. Spec adds detail page wiring + thread UI to it.
- New tabs / quick links unchanged — bottom-nav already has "Requests".
- Full UAT phase appended to `TESTING.md` in plan's last task. Mirrors SP 1 + SP 2 structure.

---

## Implementation phases (preview — full plan in writing-plans step)

| Phase | Focus | Tasks (approx) |
|---|---|---|
| 0 | Worktree setup | 1 |
| 1 | Database + storage | 2 (schema mig, storage mig) |
| 2 | Helpers | 2 (`lib/maintenance/messages.ts`, attachment validator) |
| 3 | Occupant routes + UI | 4 (GET, POST, close, page + components) |
| 4 | Staff routes + UI | 5 (POST, status extension, priority, reopen, conversation embed) |
| 5 | Shared message components | 2 (`message-bubble`, `attachment-gallery`) |
| 6 | Notifications | 1 (SMS templates + dispatch helpers) |
| 7 | Docs + UAT | 1 (TESTING.md phase) |
| 8 | Smoke + PR | 2 |

Total: ~20 tasks across 9 phases. Larger than SP 1 + SP 2 — matches roadmap estimate (4-5 working days).
