# Student Portal — Payments & Bank-Draft Upload

**Status:** approved design (ready for implementation plan)
**Date:** 2026-05-05
**Sub-project:** 1 of 4 (Payments → Invoices → Real-time issue reporting → Food ordering)

---

## 1. Goal

Let students pay their hostel bill from the portal in three ways — **online (Paystack), bank deposit (with draft upload), or in person at reception** — and give finance staff a real-time, single-screen workflow for verifying bank-draft submissions. Online payment via Paystack already works and is left intact; this spec focuses on adding the bank-deposit path end-to-end and tightening the surfacing of pending payments.

## 2. Non-goals

- Changes to the existing Paystack flow (initiation, callback, webhook, journal posting).
- Cash/MoMo/cheque entries recorded by reception staff at the desk — those continue to be created via the existing tenant-side payments form.
- Multi-currency, partial refunds, or chargebacks.
- Sub-projects 2–4 (invoice viewing, real-time issue reporting, food ordering).

## 3. User stories

| As a... | I want to... | So that... |
|---|---|---|
| Student | See exactly how much I owe and pay it from my portal | I don't have to call reception or visit the office |
| Student | Pay by bank deposit and upload my draft as proof | I can use bank channels I already trust without losing the convenience of the portal |
| Student | Know my submitted draft is being looked at | I'm not anxious about whether the hostel received it |
| Student | Get told quickly if my draft was rejected and why | I can fix it the same day instead of finding out at check-in |
| Owner / Accountant | See new draft uploads the moment they happen | I can verify against the bank statement promptly without anyone calling me |
| Owner / Accountant | Approve in one click when everything checks out | The 50th draft of the week doesn't take 30 seconds each |

## 4. Architecture overview

Bank-draft submission rides on the existing `booking_payments` infrastructure:

1. Student uploads a draft → API creates a `booking_payments` row with `status='pending'`, `method='bank_draft'`, file in a new private storage bucket.
2. Owner/accountant gets a real-time alert (in-app + web push + SMS).
3. Admin opens the queue page, reviews the file + metadata in a slide-over panel, clicks Approve or Reject.
4. Approve → row's `status` flips to `success`. Existing `paid_amount` trigger updates the booking; existing journal-posting trigger creates the accounting entry. Student notified.
5. Reject → row's `status` flips to `failed` with a required reason. Student notified and can re-upload.

No new payment ledger, no parallel verification table, no separate workflow engine. The "verification state" of a draft IS its `booking_payments.status`.

```
                                   ┌─────────────────────────────┐
   Student                         │  booking_payments           │
   /occupant-portal/payments       │  (existing table)           │
                                   │                             │
   ┌──────────────┐                │  + draft_file_path          │
   │ Pay online   │ ──Paystack──▶  │  + draft_bank_name          │
   └──────────────┘                │  + draft_number             │
                                   │  + draft_deposit_date       │
   ┌──────────────┐  upload        │  + draft_note               │
   │ Pay by bank  │ ──draft──────▶ │  + rejected_reason          │
   │ deposit (NEW)│                │  + rejected_by/at           │
   └──────────────┘                │  + approved_by/at           │
                                   └──────────────┬──────────────┘
                                                  │ realtime
                                                  ▼
                                   Admin /payments/drafts
                                   (NEW page, owner/accountant only)
                                   Approve  ─→ status: success → paid_amount + journal
                                   Reject   ─→ status: failed  → notify student
```

## 5. Schema changes

Two additive migrations:

- `20240001000055_bank_draft_submissions.sql` — column additions + RLS
- `20240001000056_bank_drafts_storage_bucket.sql` — storage bucket + storage RLS (kept separate so the bucket migration is easy to re-run safely)

Migration 055:

```sql
-- 1. Allow 'bank_draft' as a payment method
alter type payment_method add value if not exists 'bank_draft';

-- 2. Add draft-specific columns to booking_payments (all nullable)
alter table booking_payments
  add column if not exists draft_file_path     text,
  add column if not exists draft_bank_name     text,
  add column if not exists draft_number        text,
  add column if not exists draft_deposit_date  date,
  add column if not exists draft_note          text check (draft_note is null or char_length(draft_note) <= 140),
  add column if not exists rejected_reason     text,
  add column if not exists rejected_by         uuid references auth.users(id),
  add column if not exists rejected_at         timestamptz,
  add column if not exists approved_by         uuid references auth.users(id),
  add column if not exists approved_at         timestamptz;

-- 3. Enforce one-pending-draft-per-booking (DB-level guarantee)
create unique index if not exists booking_payments_one_pending_draft
  on booking_payments (booking_id)
  where status = 'pending' and method = 'bank_draft';

-- 4. Bank deposit details on tenant
alter table tenants
  add column if not exists bank_name             text,
  add column if not exists bank_branch           text,
  add column if not exists bank_account_name     text,
  add column if not exists bank_account_number   text,
  add column if not exists bank_swift_code       text,
  add column if not exists bank_instructions     text,
  add column if not exists bank_deposits_enabled boolean not null default false;

-- 5. RLS: occupant can insert their own pending drafts; can update only to cancel.
--    Owner/accountant can update status (approve/reject).
--    (Detailed policies authored in the migration; existing booking_payments
--     RLS already restricts SELECT to the row's tenant.)
```

The existing `paid_amount` trigger and journal-posting trigger fire on `status='success'` regardless of method, so approval needs no special-case logic.

## 6. Storage

New private bucket `bank-drafts`:

- Public: false. 5 MB file size limit. Allowed MIME: `application/pdf`, `image/jpeg`, `image/png`, `image/heic`.
- Path convention: `{tenant_id}/{booking_id}/{payment_id}.{ext}`.
- INSERT policy: authenticated user whose `auth.uid()` matches the booking's occupant.
- SELECT policy: same occupant + tenant members with role in (`owner`, `accountant`).
- No UPDATE, no DELETE policies on the storage objects table — drafts are evidence and never overwritten or removed individually. (Cancellation deletes the row + file via the API route's service-role client.)

## 7. API endpoints

Three new routes. All return JSON; all reuse the existing `getOccupantSession()` / `getServerTenantId()` + role-check helpers.

### `POST /api/occupant/bank-draft`

Multipart form. Body fields: `booking_id`, `amount` (pesewas), `draft_number`, `bank_name`, `deposit_date` (YYYY-MM-DD), `note?`, `file` (multipart).

Validates:
- Occupant owns the booking and tenant matches.
- `tenants.bank_deposits_enabled = true`.
- Booking has outstanding balance ≥ amount.
- No existing pending bank-draft row on this booking (DB unique index is the guarantee; route check is for friendly error).
- File: MIME in allowlist, size ≤ 5 MB, not zero-byte.

Flow:
1. Insert `booking_payments` row (`status='pending'`, `method='bank_draft'`) — get the new row's `id`.
2. Upload file to `bank-drafts/{tenant_id}/{booking_id}/{id}.{ext}`.
3. If upload fails → delete the row → return 500. (No orphan rows.)
4. Update the row's `draft_file_path` with the final storage path.
5. `waitUntil(...)`: dispatch push + SMS to owner/accountant tenant members with `contact_phone`.
6. Return `{ payment_id, status: 'pending' }`.

### `POST /api/admin/bank-draft/[id]/approve`

Body: empty.

Validates: caller is in tenant_members with role `owner` or `accountant`; row is `pending` and `method='bank_draft'`; row's tenant matches.

Flow:
1. UPDATE WHERE `status='pending'` (optimistic lock). If 0 rows → return 409.
2. Set `status='success'`, `approved_by`, `approved_at`. Existing triggers update `paid_amount` and post to journal.
3. `waitUntil(...)`: push + SMS to student.
4. Return `{ status: 'success' }`.

### `POST /api/admin/bank-draft/[id]/reject`

Body: `{ reason: string (required, ≥3 chars, ≤500 chars) }`.

Validates: same role check; row is `pending`; reason present.

Flow:
1. UPDATE WHERE `status='pending'`. If 0 rows → 409.
2. Set `status='failed'`, `rejected_reason`, `rejected_by`, `rejected_at`.
3. `waitUntil(...)`: push + SMS to student with reason.
4. Return `{ status: 'failed' }`.

### `POST /api/admin/bank-draft/[id]/undo`

Body: empty.

Validates: caller is owner/accountant; row's `status='success'` and `method='bank_draft'`; `approved_at > now() - interval '5 minutes'`.

Flow:
1. UPDATE WHERE same conditions, set `status='pending'`, clear `approved_by`/`approved_at`. If 0 rows → 410 Gone.
2. The existing `paid_amount` trigger re-aggregates and decrements the booking's paid amount automatically.
3. No notification dispatched (admin internal action).

### Cancellation by student

`DELETE /api/occupant/bank-draft/[id]` — only allowed while `status='pending'` and the row belongs to the student.

Storage and Postgres are separate systems and cannot share a transaction. Order: **delete the file first, then the row.** If the file delete fails, the row is kept and the route returns a retryable error — this leaves the system in a consistent "still pending" state. If the file delete succeeds but the row delete fails (very rare, e.g. DB hiccup), an orphan row exists for a moment but the next cancel attempt cleans it up; even if it lingers, admin can still reject the row from the queue. No notification dispatched on cancellation.

### Why no separate "queue list" endpoint

The admin queue page is a React Server Component that queries `booking_payments` directly using the admin client. The realtime feed is layered on the client side via Supabase realtime — the page's initial render is server-rendered and instant; subscriptions handle deltas.

## 8. Student UI

All changes are contained in `apps/web/app/(occupant-portal)/occupant-portal/payments/page.tsx` and a small set of new client components in `apps/web/components/occupant-portal/`.

### 8.1 Payment method picker

Below the existing balance card and Paystack "Pay Online" button, a new section card shows the payment-method picker. Only the methods enabled on the tenant render:

- **Pay online** — existing Paystack button (no change).
- **Pay by bank deposit** (NEW) — collapsed by default; tap to expand.

If the student has a pending draft, the picker label shows "1 draft awaiting verification" and the method row is collapsed but pre-emphasised.

### 8.2 Bank deposit details (revealed on expand)

When student taps "Pay by bank deposit," the section reveals:

1. The hostel's bank deposit details from `tenants.bank_*`. Each field renders as a row with a one-tap "Copy" button (account number especially). Optional `bank_instructions` renders as a small note below the rows.
2. A divider with "After you've deposited, upload your draft below."
3. The upload form (see 8.3).

If `tenants.bank_deposits_enabled = false` or required fields are blank, the entire "Pay by bank deposit" picker row is hidden.

### 8.3 Upload form

Fields, all visible (no progressive disclosure):

- File picker — visual upload dropzone, accepts PDF / JPG / PNG / HEIC, max 5 MB.
- Amount (GHS) — defaults to outstanding balance, editable.
- Draft / cheque number.
- Bank — defaults to `tenants.bank_name`, editable in case the student used a different bank's draft.
- Deposit date — defaults to today.
- Note (optional) — single-line input, ≤140 chars.
- "Submit for verification" button.

Client-side validation mirrors server-side. On success, the form collapses and the pending state (8.4) takes its place without a full page reload.

### 8.4 Pending state

While a draft is `pending`:

- Method picker label: "1 draft awaiting verification."
- Inside the expanded section, the upload form is replaced by a status card:
  - "⏳ Awaiting verification — Draft #{n} · GHS {amount} · {N} hours ago"
  - Two buttons: **View draft** (opens the file in a new tab via signed URL), **Cancel submission**.
- Paystack "Pay online" remains available — student can pay any remaining balance online while the draft is in review.

### 8.5 Payment history

Existing payment history list already keys off `booking_payments`, so pending and rejected rows just need visual treatment:

- Pending: amber clock icon, "Awaiting verification."
- Rejected: red X icon, "Rejected — {reason}" (truncated to one line, tap to expand).
- Approved: existing green checkmark treatment.

## 9. Admin UI

### 9.1 New page: `/payments/drafts`

Sits inside the existing tenant dashboard, nested under "Payments → Bank drafts" in the sidebar. Visible only to users with role `owner` or `accountant`.

Sidebar entry has a red dot + count badge whenever pending drafts > 0; the count updates in real time via the same Supabase channel as the queue page.

### 9.2 Queue list

A simple table, oldest first:

| Resident | Amount | Draft # | Bank | Deposit date | Submitted |
|---|---|---|---|---|---|

Column-sized to fit a 1280px viewport without horizontal scroll. The "Submitted" column shows relative time ("3h ago"); rows older than **24 hours** show in red with a small ⚠ icon to nudge the verifier.

Tapping a row opens a slide-over review panel from the right (page stays visible behind a soft overlay).

### 9.3 Review slide-over panel

Top of panel: embedded preview of the file (PDF rendered via existing `@react-pdf/renderer` viewer pattern; images via `<img>`). Tap to enlarge to full screen.

Below: outstanding balance highlight ("Outstanding on this booking: GHS 3,600"), then a 2-column grid of all metadata (resident, booking ref, amount, draft #, bank, deposit date), then the resident's note, then a small info banner explaining what approval will do.

Footer: two buttons.
- **Reject** (white, red text) — opens an inline textarea overlay; reason required (≥3 chars). Submitting closes the panel.
- **Approve GHS {amount}** (green, primary) — single click, no confirmation dialog. Closes the panel and removes the row from the queue with a brief checkmark animation.

If draft amount > outstanding balance, the slide-over shows a warning above the buttons: "This will create a credit of GHS X on the booking." Approval is still allowed.

### 9.4 Recently processed

Below the queue, a collapsible "Recently processed (today)" section lists same-day approvals + rejections. Approved rows show an Undo link for 5 minutes after approval; the link is hidden client-side after the window expires AND the underlying `POST /api/admin/bank-draft/[id]/undo` route enforces the same window server-side (`WHERE approved_at > now() - interval '5 minutes'`). Undo flips the row back to `pending` (and the existing `paid_amount` trigger, which sums success rows, decrements automatically). After 5 minutes the link disappears in the UI and the route returns 410 Gone — once it's been in the journal for that long, it stays.

## 10. Tenant settings

A new section in `/settings` titled **"Bank Deposit Details"** — sits next to the existing branding/SMS-sender blocks. Owner-only; other staff see it read-only.

Fields:
- Bank name *
- Branch
- Account name *
- Account number * (≥6 digits)
- SWIFT / sort code (optional, validated to standard pattern)
- Deposit instructions (optional, ≤280 chars)
- "Bank deposits enabled" toggle. The DB default is `false`; the settings POST route auto-flips it to `true` the first time all required fields are saved together. After that, owner can toggle freely.

A soft amber banner on the settings page header suggests configuring bank deposits if Paystack is set but bank fields are blank. Dismissible.

## 11. Notifications & realtime

### 11.1 Notification matrix

| Event | Recipient | Channels |
|---|---|---|
| Student uploads draft | Tenant users with role `owner` / `accountant` who have `contact_phone` | Web push + SMS + realtime queue update |
| Admin approves draft | The student | Web push + SMS |
| Admin rejects draft | The student | Web push + SMS (includes reason) |

### 11.2 Implementation

All dispatched via `waitUntil(...)` after the API route returns its 200 response, so a slow or failing notification never blocks the user-facing action.

- Push: existing `web-push` infra in `apps/web/app/api/push/` + `user_push_subscriptions` table.
- SMS: existing Arkesel client + the tenant SMS sender introduced in migration 054.
- Both reused as-is; no new infrastructure.

### 11.3 Realtime

A single Supabase realtime channel per tenant: `tenant_drafts:{tenant_id}`. Subscribed on:

- `/payments/drafts` queue page — INSERT adds rows with a slide-in animation, UPDATE animates rows out as they're approved/rejected, DELETE removes cancelled rows.
- The admin sidebar badge component — listens for count change.

RLS on `booking_payments` already restricts to tenant; the realtime channel inherits those policies.

If the realtime connection drops, the page subscribes to `connection-state-change` and shows a small "Reconnecting…" pill at the top. On reconnect, it does one fresh fetch to catch up on missed events.

## 12. Edge cases

| # | Case | Handling |
|---|---|---|
| 1 | Student uploads, then balance hits zero from another payment | Approve still works; warning shown in slide-over; overpayment recorded in `notes` |
| 2 | Draft amount > balance | Approval allowed; warning shown; creates credit |
| 3 | Booking cancelled while draft pending | Cancellation route flips draft to `failed` with reason "booking cancelled"; student notified |
| 4 | Admin approves then rejects same row | Optimistic lock; second action returns 409; panel re-fetches |
| 5 | Two admins approve same row simultaneously | First wins; second gets 409 |
| 6 | Student cancels own pending draft | Allowed only while pending; deletes row + file in one transaction; no notification |
| 7 | File upload fails after row insert | Row rolled back; no orphans |
| 8 | SMS provider down | Logged to `webhooks` audit table; action still succeeds; admin sees soft banner |
| 9 | Tenant disables bank deposits while drafts pending | Existing pending drafts still approvable; only new uploads blocked |
| 10 | Student tries to upload with zero balance | API returns 400; UI hides section preemptively |

## 13. Testing strategy

### 13.1 Unit (Vitest, `apps/web/lib/__tests__/`)
- `bank-draft.ts` helpers — file validation, MIME sniffing, path construction, single-pending guard.
- Notification dispatch — push payload shape, SMS template rendering with placeholders.

### 13.2 API integration (`apps/web/app/api/.../__tests__/`)
- Happy path: upload → row exists, file in bucket, push fired (mocked), SMS fired (mocked).
- Concurrent approve from two admins → second returns 409.
- Cancel pending draft → row + file gone.
- Auth: occupant from tenant A cannot see tenant B's drafts; receptionist cannot approve.
- Reject without reason → 422.

### 13.3 RLS (Postgres-level)
- Occupant can only insert/select their own rows.
- Owner/accountant can update status; receptionist cannot.

### 13.4 Manual UAT (added to `TESTING.md`)
- Upload from phone — picture too big, picture wrong format, no file, no balance.
- Approve from admin — confirm `paid_amount` updates, journal entry posts, student SMS arrives, queue row disappears.
- Reject — confirm reason required, student SMS arrives, student can re-upload.
- Settings — disable bank deposits, confirm method hides on portal.
- Realtime — open admin queue in two browser windows, upload from a third device, both windows update without refresh.

## 14. Files affected (summary, not the implementation plan)

**New:**
- `supabase/migrations/20240001000055_bank_draft_submissions.sql`
- `supabase/migrations/20240001000056_bank_drafts_storage_bucket.sql`
- `apps/web/app/api/occupant/bank-draft/route.ts`
- `apps/web/app/api/occupant/bank-draft/[id]/route.ts` (cancel)
- `apps/web/app/api/admin/bank-draft/[id]/approve/route.ts`
- `apps/web/app/api/admin/bank-draft/[id]/reject/route.ts`
- `apps/web/app/api/admin/bank-draft/[id]/undo/route.ts`
- `apps/web/app/(tenant)/payments/drafts/page.tsx`
- `apps/web/components/payments/draft-queue.tsx` (client, realtime)
- `apps/web/components/payments/draft-review-panel.tsx`
- `apps/web/components/occupant-portal/bank-deposit-section.tsx`
- `apps/web/components/occupant-portal/draft-upload-form.tsx`
- `apps/web/components/occupant-portal/pending-draft-card.tsx`
- `apps/web/components/settings/bank-deposit-form.tsx`
- `apps/web/lib/bank-draft.ts` (validation + dispatch helpers)

**Modified:**
- `apps/web/app/(occupant-portal)/occupant-portal/payments/page.tsx`
- `apps/web/app/(tenant)/settings/page.tsx`
- `apps/web/components/admin-sidebar.tsx` (badge + realtime subscription)
- `TESTING.md`
- `APP_OVERVIEW.md`

## 15. Decisions log

| # | Decision | Choice |
|---|---|---|
| 2 | Workflow when student uploads | B — pre-filled pending payment row |
| 3 | Metadata collected | Minimal: amount, draft #, bank, deposit date, file, optional note |
| 4 | Admin alert channels | C — in-app + web push + SMS |
| 5 | Who can approve/receive alerts | B — owner + accountant only |
| 6 | Where bank account details shown | A — inline on payment page |
| 7 | Rejection flow | A — required reason, no re-upload cap |
| 8 | Concurrent pending drafts | A — one in-flight per booking (DB-enforced) |
| 9 | Schema location | A — extend `booking_payments` |
| UI | Bank deposit section default state | Collapsed |
| UI | Pending state buttons | Both "View draft" + "Cancel submission" |
| UI | Admin review pattern | Slide-over from right |
| UI | Stale warning threshold | 24 hours |
| UI | Sidebar placement | Nested under Payments |
| UI | Approve confirmation | Single click |

---

**Next step after approval of this spec:** invoke the `writing-plans` skill to produce a detailed, ordered implementation plan with explicit file paths, function signatures, and test cases.
