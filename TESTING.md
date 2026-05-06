# Testing Plan

Last updated: 2026-04-11

This document covers the full testing checklist for GH Hostels — from localhost to production.
Work through phases in order. Each phase builds on the previous.

---

## Prerequisites

Complete these before running any test phase.

### 1. Environment variables (`apps/web/.env.local`)

**Required for all testing:**
```bash
NEXT_PUBLIC_SUPABASE_URL=         # Supabase → Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # same
SUPABASE_SERVICE_ROLE_KEY=        # same (never expose publicly)
NEXT_PUBLIC_APP_DOMAIN=localhost  # keeps subdomain routing dormant on local
```

**Optional for localhost (required for production):**
```bash
UPSTASH_REDIS_REST_URL=           # Upstash console → REST API (degrades gracefully without)
UPSTASH_REDIS_REST_TOKEN=
RESEND_API_KEY=                   # transactional email (invites, receipts)
RESEND_FROM_EMAIL=no-reply@yourdomain.com
ARKESEL_API_KEY=                  # SMS gateway (Ghana)
ARKESEL_SENDER_ID=                # max 11 chars, registered with Arkesel
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=  # Paystack test keys first, then live
PAYSTACK_SECRET_KEY=
VERCEL_API_TOKEN=                 # for custom domain provisioning via Vercel API
VERCEL_PROJECT_ID=
VERCEL_TEAM_ID=                   # only for team accounts
```

> If Resend is not configured, invite emails won't send but the API returns success.
> Get the magic link from **Supabase Dashboard → Authentication → Users** instead.

### 2. Apply all database migrations

```bash
# From the project root
supabase db push

# Or if using Supabase cloud dashboard:
# Run each file in supabase/migrations/ in numeric order
```

### 3. Register the JWT hook — CRITICAL

Without this, `portal_role` is never set and all portal routing silently breaks.

**Supabase Dashboard → Authentication → Hooks → Custom Access Token Hook**
Set function to: `public.custom_access_token_hook`

---

## Phase 1 — Owner Signup & Onboarding

| # | Action | Expected result |
|---|--------|----------------|
| 1 | Go to `/signup`, fill hostel name + email + password | Form submits, confirmation email arrives |
| 2 | Click confirmation email link | Lands on `/onboarding` (not `/dashboard`) |
| 3 | Complete all 4 wizard steps: Identity → Branding → Rooms → Done | Wizard saves without errors |
| 4 | Click "Go to dashboard" | Dashboard loads with your hostel name and colour |
| 5 | Refresh the page | Still on dashboard, not redirected to login |

---

## Phase 2 — Room & Booking Lifecycle (Core Admin Flow)

| # | Action | Expected result |
|---|--------|----------------|
| 6 | Rooms → Categories → New: create a room type (e.g. "Single", GHS 800/month) | Saves, appears in list |
| 7 | Rooms → New: create 2–3 rooms using that category | Appear with "Available" status |
| 8 | Occupants → New: create an occupant with a real email you control | Saved in list |
| 9 | Bookings → New: book that occupant into a room | Status = "Pending payment" |
| 10 | Open the booking → Record a partial payment | Paid amount updates, status stays pending |
| 11 | Record the remaining balance | Status auto-updates to "Confirmed" |
| 12 | Change status → Check in | Status = "Checked in", room goes "Occupied" |
| 13 | Invoices → open the invoice → Download PDF | PDF opens correctly |
| 14 | Change booking status → Check out | Room reverts to "Available" |

---

## Phase 3 — Occupant Portal

This is the most critical flow. The auth callback fix must route invites to `/occupant-portal`, not `/onboarding`.

| # | Action | Expected result |
|---|--------|----------------|
| 15 | Occupants → open the occupant → click **Send portal invite** | Returns success; check Supabase Auth → Users for the invite record |
| 16 | Click the invite link in the email (or paste magic link from Supabase dashboard) | Lands on `/occupant-portal` — **not** `/onboarding` |
| 17 | Home tab | Shows the booking, balance, and quick action buttons |
| 18 | Payments tab | Shows balance split (total / paid / balance), payment history |
| 19 | Maintenance → New request | Submit a request; it appears in the list immediately |
| 20 | Notices tab | Shows any notices created in Communications (create one first) |
| 21 | Profile → Settings → Change password | "Reset email sent" message appears |
| 22 | Click the reset link in email | Lands on `/occupant-portal/settings/update-password` — **not** the admin reset page |
| 23 | Set a new password and save | Redirects to `/occupant-portal/profile` with success state |

---

## Phase 4 — Staff Portal

| # | Action | Expected result |
|---|--------|----------------|
| 24 | Staff → New: add a staff member (role: Housekeeper) with a different real email | Saved |
| 25 | Housekeeping module → assign a task to that staff member | Task appears in their queue |
| 26 | Open the staff record → Send invite | Invite created in Supabase Auth |
| 27 | Accept the invite link | Lands on `/staff-portal` — not dashboard, not onboarding |
| 28 | Tasks tab | Shows the assigned housekeeping task |
| 29 | Click **Start** on a task | Status updates to "In Progress" without page reload |
| 30 | Click **Done** | Status updates to "Done", room marked clean |
| 31 | Requests tab | Shows open maintenance requests |
| 32 | Tap any request → change status to "In Progress" | Updates live |
| 33 | Profile tab | Shows staff name, job title, recent attendance |

---

## Phase 5 — Public Booking Page

| # | Action | Expected result |
|---|--------|----------------|
| 34 | Visit `/book/your-slug` (use the slug from onboarding) | Booking page loads with hostel name + available rooms |
| 35 | Select a room, fill in occupant details, submit | Booking created, payment screen appears |
| 36 | (If Paystack test keys set) Complete a test payment | Booking status updates in admin dashboard |

---

## Phase 6 — Access Control Edge Cases

| Scenario | Expected result |
|----------|----------------|
| Log out as occupant → visit `/dashboard` | Redirected to `/login` |
| Log in as occupant → visit `/dashboard` | Redirected to `/occupant-portal` |
| Log in as staff → visit `/accounting` | Redirected to `/staff-portal` |
| Log in as owner → visit `/occupant-portal` | Accessible (owners bypass portal guards) |
| Visit `/book/nonexistent-slug` | 404 or "Hostel not found" |

---

## Phase 7 — Communications

| # | Action | Expected result |
|---|--------|----------------|
| 37 | Communications → Notices → New: create a pinned urgent notice | Saves and publishes |
| 38 | Log in as occupant → Notices tab | Notice appears at the top (pinned) |
| 39 | Home tab | Pinned notice preview appears in the notices card |

---

## After Localhost — Pre-Production Checklist

Once all phases pass locally, do the following before going live:

- [ ] Set `NEXT_PUBLIC_APP_DOMAIN` to your real domain (e.g. `gh-hostels.com`)
- [ ] Provision an **Upstash Redis** instance and add env vars — subdomain routing needs it
- [ ] Configure **Resend** so invite and receipt emails actually deliver
- [ ] Add **Paystack test keys**, run a live payment through Phase 5, then swap to live keys
- [ ] Configure **Arkesel** for SMS receipts on booking payments
- [ ] Deploy to **Vercel** with all env vars set in the Vercel dashboard
- [ ] Re-run Phases 3–5 on the real domain with subdomain routing active
- [ ] Verify `custom_access_token_hook` is registered on the production Supabase project
- [ ] Verify at least one tenant subdomain resolves correctly: `yourslug.gh-hostels.com`
- [ ] Test a custom domain CNAME setup end-to-end (Settings → Custom Domain)

---

## Known Localhost Caveats

| Area | Behaviour on localhost |
|------|----------------------|
| Subdomain routing | Disabled — all routes on `localhost:3000` |
| Redis cache | Optional — falls back to direct DB lookup automatically |
| Email (Resend) | Won't send — use Supabase Auth dashboard to get magic links |
| SMS (Arkesel) | Won't send — no impact on core flows |
| Paystack | Only works if test keys are configured |
| Custom domains | Cannot be tested locally |

---

## Key URLs (localhost)

| Portal | URL |
|--------|-----|
| Admin dashboard | `http://localhost:3000/dashboard` |
| Public booking page | `http://localhost:3000/book/{slug}` |
| Occupant portal | `http://localhost:3000/occupant-portal` |
| Staff portal | `http://localhost:3000/staff-portal` |
| Onboarding | `http://localhost:3000/onboarding` |
| Login | `http://localhost:3000/login` |
| Signup | `http://localhost:3000/signup` |

---

## Phase — Bank Draft Submissions

Pre-requisites:
- Migrations 055 + 056 applied.
- Test tenant has bank deposit details saved in `/settings` and "Enabled" toggle ON.
- A test occupant with an active booking that has outstanding balance.
- (Optional) `ARKESEL_API_KEY` set to test SMS; otherwise SMS is no-op'd with a console log.
- (Optional) Push subscription registered for an admin browser to test web push.

### Student side

- [ ] On `/occupant-portal/payments`, the "Pay by bank deposit" card appears below the balance card.
- [ ] Tap to expand: hostel's bank details show; "Copy" buttons work on account number.
- [ ] Submit form requires: file (≤5 MB, PDF/JPG/PNG/HEIC/HEIC-sequence), amount, draft #, bank, deposit date.
- [ ] Reject too-large file (>5 MB) — friendly error, no upload attempted.
- [ ] Reject wrong format (e.g. .docx) — friendly error.
- [ ] Successful submission — section collapses to amber pending card.
- [ ] Pending row also appears in payment history with amber clock pill.
- [ ] "View draft" opens the file in a new tab via signed URL.
- [ ] "Cancel submission" requires double-tap; row + file disappear.
- [ ] Trying to submit a second draft while one is pending — server returns 409.

### Admin side

- [ ] Sidebar shows a red "1" badge next to Bank Drafts (Finance section) when a pending draft exists.
- [ ] Sidebar collapsed: red dot overlays the Banknote icon when count > 0.
- [ ] `/payments/drafts` lists the pending draft with all metadata.
- [ ] Click row → slide-over opens with file preview, balance, and Approve/Reject buttons.
- [ ] Approve — row disappears, `bookings.paid_amount` reflects the payment, journal entry posts.
- [ ] Approve again on the same row → 409 "Already processed".
- [ ] Reject without reason → 422.
- [ ] Reject with reason → row moves to "Recently processed" with red badge + reason.
- [ ] Within 5 min of approval, Undo link reverts the row to pending and decrements paid_amount.
- [ ] After 5 min, Undo returns 410.
- [ ] Stale warning: a row older than 24h shows red "Stale" indicator.

### Realtime

- [ ] Open `/payments/drafts` in two admin browsers. Upload a draft from a third browser as the occupant.
- [ ] Both admin browsers show the new row WITHOUT refresh, within ~1s.
- [ ] First admin clicks Approve. Second admin's view removes the row WITHOUT refresh.
- [ ] Sidebar badge counts decrement in both windows.

### Notifications

- [ ] Web push fires to subscribed admin browsers on upload.
- [ ] (If Arkesel configured) Admin SMS arrives within ~5s of upload.
- [ ] (If Arkesel configured) Student SMS arrives within ~5s of approval.
- [ ] (If Arkesel configured) Student SMS includes rejection reason on reject.
- [ ] Push provider unavailable — upload still succeeds; warning in server logs only.

### Settings interactions

- [ ] Owner sets bank fields, saves. `bank_deposits_enabled` auto-flips to true (form omits the toggle when user hasn't touched it).
- [ ] Owner toggles "Enabled" off. Student portal: "Pay by bank deposit" card hides immediately on next page load. Existing pending drafts still visible to admin.
- [ ] Non-owner role attempting PATCH to `/api/settings/branding` with bank fields → 403.
- [ ] Receptionist / housekeeper / manager: Finance sidebar section is hidden; direct GET to `/payments/drafts` redirects to `/dashboard`.

### Booking cancellation interaction

- [ ] Submit a draft (status=pending). Cancel the underlying booking from `/bookings/[id]`. Migration 055 trigger flips the draft to status=failed with rejected_reason='booking cancelled'.

---

## Phase — Invoice Viewing & Download

Pre-requisites:
- A test occupant logged into `/occupant-portal` with at least one booking.
- (Optional, for cancelled-state coverage) Cancel one of the test occupant's bookings via `/bookings/[id]`.

### Listing

- [ ] Bottom nav shows "Invoices" tab between Payments and Requests.
- [ ] `/occupant-portal/invoices` renders an Invoices header + list of card per booking, sorted most recent first.
- [ ] Status pill on each card matches expected color:
  - Paid (emerald) when `paid_amount >= final_amount`
  - Partial (amber) when 0 < paid_amount < final_amount
  - Unpaid (red) when paid_amount = 0
  - Cancelled (slate) when booking status = 'cancelled' (overrides above)
- [ ] Each card shows invoice number (or booking_ref fallback for legacy rows), room/block, booking_ref, stay dates, total amount.
- [ ] Empty state appears for an occupant with no bookings.
- [ ] Home page (`/occupant-portal`) quick-links section shows "View invoices · Download tax-compliant receipts".

### Detail

- [ ] Tap a card → `/occupant-portal/invoices/[id]` loads.
- [ ] Header shows invoice number, issue date, resident name, booking ref, room, stay dates.
- [ ] Cancelled booking shows slate "Cancelled" pill on detail header.
- [ ] Line items section lists accommodation + tax breakdown; only non-zero tax lines appear.
- [ ] Discount line appears with reason when `discount_amount > 0`.
- [ ] Payments section lists only payments with `status = 'success'`.
- [ ] Bank-draft payments (from sub-project 1) show as "Bank Draft · ..." in the payments list once approved.
- [ ] Totals: Paid + Balance match `bookings.paid_amount` and `final_amount - paid_amount`.

### PDF download

- [ ] Tap "Download PDF" → file downloads as `invoice-<invoice_number>.pdf` (or `invoice-<booking_ref>.pdf` if no invoice_number).
- [ ] PDF opens correctly: hostel letterhead, resident, room, line items, taxes, payment history, totals.
- [ ] Tax fields show only if non-zero; matches detail page.
- [ ] PDF includes paid bank-draft payments in the payments section.

### Auth & access

- [ ] Direct GET to `/occupant-portal/invoices/<some-other-occupant's-id>` shows the Next.js 404 page (not detail view).
- [ ] Direct GET to `/api/occupant/invoices/<some-other-occupant's-id>/pdf` returns 404 JSON.
- [ ] Logged-out user navigating to `/occupant-portal/invoices` redirects to `/login`.
- [ ] An occupant who has been checked out can still see + download invoices for past bookings.

---

## Phase — Real-Time Issue Reporting

Pre-requisites:
- Test occupant logged in with at least one open `maintenance_request`.
- A staff account with `manager` or `housekeeper` role for replies.

### Threading

- [ ] Occupant `/occupant-portal/maintenance/[id]` loads with empty thread (or pre-existing messages).
- [ ] Occupant sends text message → appears in staff `/maintenance/[id]` view within ~1s.
- [ ] Staff replies → appears in occupant view in ~1s without page refresh.
- [ ] Both sides see attachments rendered as filename pills; click opens signed URL in new tab.
- [ ] Body > 2000 chars rejected.
- [ ] >5 files in single message rejected.
- [ ] File >5 MB rejected.
- [ ] Wrong MIME (e.g. .exe renamed .pdf) rejected by bucket policy.

### System messages

- [ ] Staff changes status open → in_progress → system message renders centered as pill in both views.
- [ ] Status change triggers occupant push notification.
- [ ] Status change sends SMS to occupant (if Arkesel configured).
- [ ] Admin priority bump renders system message; push only (no SMS).
- [ ] Resident "Mark as resolved" → confirm modal → status flips to completed; system message; staff get push.
- [ ] Admin reopens completed request → status back to open; system message; resident gets push + SMS.

### Notification volume

- [ ] First-ever staff reply: occupant push + SMS.
- [ ] Subsequent staff replies: push only.
- [ ] First occupant reply since latest staff message: push to all owner/manager/housekeeper.
- [ ] Subsequent occupant replies before staff replies: no staff push.

### Auth & access

- [ ] Direct GET `/occupant-portal/maintenance/<another-occupant's-request>` → 404.
- [ ] Direct POST `/api/occupant/maintenance/<another-occupant's-id>/messages` → 404.
- [ ] Logged-out → redirect to /login.
- [ ] Receptionist / accountant / security → 403 on PATCH `/api/maintenance/[id]/priority`.
- [ ] Resident on a checked-out booking → POST messages 403.
- [ ] Closed request occupant POST → 409.

### Realtime resilience

- [ ] Disconnect network 30s → reconnect → in-flight staff messages appear.
- [ ] Two browser tabs → message in tab A appears in tab B within ~1s.

---

## Phase — Food Ordering

Pre-requisites:
- `food_orders_enabled = true` for the test tenant.
- At least 3 `menu_items` published for today.
- Test occupant has an active booking.
- Paystack test keys + `paystack_subaccount_code` configured for online path.
- VAPID + Arkesel for push + SMS UAT (else silently no-op).

### Menu management

- [ ] Owner creates a category → appears on tenant `/food/menu` page.
- [ ] Owner creates an item with photo upload → photo URL renders on occupant menu.
- [ ] Manager can toggle `is_sold_out` → item shows greyed-out card on occupant menu.
- [ ] Item with `publish_date = yesterday` does NOT appear on occupant menu.
- [ ] Item with `publish_date = today` appears.
- [ ] Item with `publish_date = null` (always-on) appears.
- [ ] Item with `is_available = false` does NOT appear on occupant menu.

### Cart

- [ ] Add item from occupant menu → cart pill at bottom shows count + total.
- [ ] Quantity stepper enforces 1–10.
- [ ] Cart persists across logout / login (server-side `food_carts`).
- [ ] Setting quantity to 0 (minus) removes line.
- [ ] Cart page shows unavailable items dimmed with "no longer available".

### Order placement — online

- [ ] Submit cart with online → redirected to Paystack test page.
- [ ] Paystack test success → webhook stamps `paid_at` + `paystack_reference`. Kitchen queue receives order in <2s.
- [ ] Abandon payment (close tab) → after 30 min cron sweep marks order `cancelled` with reason "Payment not completed within 30 minutes".
- [ ] Manual `curl -X POST /api/cron/food-orders-sweep -H "Authorization: Bearer $CRON_SECRET"` reports `{swept: N}`.

### Order placement — cash on pickup

- [ ] Submit cart with cash → kitchen queue receives order immediately, no Paystack redirect.
- [ ] Tracker page lands at `placed`.

### Kitchen queue

- [ ] Three columns (Placed / Preparing / Ready) populate from initial fetch.
- [ ] New order appears in Placed column within 1s of placement.
- [ ] "Start preparing" → moves to Preparing column live in all open browsers.
- [ ] "Mark ready" → moves to Ready; resident push fires; SMS fires (if `food_ready_sms` + Arkesel).
- [ ] "Mark picked up" → order disappears from queue.
- [ ] Cancel with reason → order disappears; resident push + SMS fire; refund attempt logged for online+paid.

### Tracker

- [ ] Tracker page loads with current status pill stepper.
- [ ] Status changes from kitchen reflect live (no refresh).
- [ ] Cancel button visible only at `placed`.
- [ ] Cancel from tracker → moves to cancelled; refund attempt for online+paid.

### Auth & access

- [ ] Direct GET `/api/occupant/food-orders/<another-occupant's-id>` → 404.
- [ ] Receptionist → 403 on POST `/api/menu/items` (owner/manager only).
- [ ] Housekeeper → 200 on PATCH `/api/menu/items/[id]` toggling `is_sold_out` only.
- [ ] Housekeeper → 403 on PATCH `/api/menu/items/[id]` changing price.
- [ ] Logged-out user → /login redirect on `/occupant-portal/food`.
- [ ] When `food_orders_enabled = false`: bottom-nav Food tab hidden; `/occupant-portal/food` shows "Food ordering not enabled" empty state; sidebar Food entries hidden via role-irrelevant route 404.

### Refunds

- [ ] Cancel an online+paid order → Paystack dashboard shows refund request created.
- [ ] Cancel a cash order before pickup → no Paystack call (no money moved).
- [ ] Cancel an online+unpaid order → no Paystack call.
