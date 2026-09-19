# Testing Plan

Last updated: 2026-09-19

This document covers the full testing checklist for GH Hostels — from localhost to production.
Work through phases in order. Each phase builds on the previous.

See the **Feature Coverage Map** near the end for which modules have a phase here and which
don't yet — check that before assuming "not listed" means "not shippable," and update it
whenever you add or remove a phase so this doc doesn't quietly go stale again.

---

## Automated tests (run these first)

Before any manual QA below, run the automated suite — it catches regressions in minutes that
this checklist would take an hour to find by hand:

```bash
npm run type-check                              # whole monorepo
npm --workspace @gh-hostels/web run lint
npm --workspace @gh-hostels/web run test        # unit tests + real-Postgres RLS/grant tests
npm --workspace @gh-hostels/web run audit:tenant-scoping   # static: admin-client queries scoped by tenant_id?
npm --workspace @gh-hostels/web run audit:function-grants  # static: SECURITY DEFINER RPCs over-exposed?
```

The `test` script boots a throwaway Postgres cluster (via `embedded-postgres`) and replays real
migration SQL against it — no Supabase project or `.env.local` needed for this step. It covers
tenant isolation (RLS), the two storage-bucket policies, the tenant-admin client wrapper, and the
RPC grant boundary. It does **not** cover anything below this line: UI flows, third-party
integrations (Paystack, Arkesel, Brevo, Paystack webhooks), or business logic that only runs
inside a real Next.js request. All CI-enforced; a red run here means don't bother with manual QA
until it's green.

---

## Prerequisites

Complete these before running any manual test phase below.

### 1. Environment variables (`apps/web/.env.local`)

**Required for all testing:**
```bash
NEXT_PUBLIC_SUPABASE_URL=         # Supabase → Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # same
SUPABASE_SERVICE_ROLE_KEY=        # same (never expose publicly)
NEXT_PUBLIC_APP_DOMAIN=localhost  # keeps subdomain routing dormant on local
```

**Optional for localhost (required for production, or for the specific phase that needs them):**
```bash
UPSTASH_REDIS_REST_URL=           # Upstash console → REST API (degrades gracefully without)
UPSTASH_REDIS_REST_TOKEN=
BREVO_API_KEY=                    # transactional email (invites, receipts) — replaced Resend
BREVO_FROM_EMAIL=no-reply@yourdomain.com
ARKESEL_API_KEY=                  # SMS gateway (Ghana)
ARKESEL_SENDER_ID=                # max 11 chars, registered with Arkesel
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=  # Paystack test keys first, then live
PAYSTACK_SECRET_KEY=
PAYSTACK_PLAN_STARTER_MONTHLY=    # + QUARTERLY/BIANNUAL/ANNUAL, same for GROWTH — needed for
PAYSTACK_PLAN_GROWTH_MONTHLY=     #   the Subscription Billing phase only; bootstrap via
                                   #   POST /api/admin/paystack/bootstrap-plans (platform-admin)
VERCEL_ACCESS_TOKEN=              # for custom domain provisioning via Vercel API
VERCEL_PROJECT_ID=
VERCEL_TEAM_ID=                   # only for team accounts
VAPI_API_KEY=                     # voice AI agent — only needed if testing that channel
OPENAI_API_KEY=                   # embeddings for the AI assistant's knowledge base
ANTHROPIC_API_KEY=                # powers the AI Assistant (Claude)
```

> If Brevo is not configured, invite emails won't send but the API returns success.
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
- [ ] Configure **Brevo** so invite and receipt emails actually deliver
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
| Email (Brevo) | Won't send — use Supabase Auth dashboard to get magic links |
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

---

## Phase — Public Food Ordering Channels (Walk-in QR + Online)

Pre-requisites:
- Migration 062 applied.
- Tenant has `food_orders_enabled = true` and seeded menu (from Phase — Food Ordering pre-reqs).
- Paystack test keys for online channel UAT.

### Public menu page

- [ ] Open `/order/<slug>` in incognito → menu renders with tenant logo + brand color, no auth required.
- [ ] Item cards show photos, prices, sold-out state.
- [ ] Add 2 items → cart pill at bottom right shows count + total.
- [ ] LocalStorage persists cart across reload (same browser).
- [ ] Different browser / incognito has empty cart (per-browser state).
- [ ] If `food_orders_enabled = false` → "Online ordering not available" empty state (no menu fetch).

### Walk-in cash flow

- [ ] On menu, add items → click cart pill → land on `/order/<slug>/cart`.
- [ ] Cart shows lines + total. Sold-out items shown dimmed with "Sold out" hint.
- [ ] Pick "Dine-in / pickup at restaurant" → table_label input visible.
- [ ] Fill name, phone, table "T5" → pick "Pay on pickup (cash)" → Place order.
- [ ] Redirected to `/order/<slug>/orders/<id>?token=<...>` tracker showing `placed`.
- [ ] Order_ref `F-XXXX` displayed.
- [ ] SMS received with tracking URL (if Arkesel configured).
- [ ] Refresh tracker → still works (token in URL).

### Walk-in online flow

- [ ] Same form, pick "Pay online" → redirected to Paystack test page.
- [ ] Test card `4084 0840 8408 4081` → success → returns to tracker.
- [ ] Webhook stamps `paid_at` + `paystack_reference`. Kitchen receives push.

### Online channel

- [ ] On cart, pick "Order ahead online" → cash radio hidden / disabled.
- [ ] Submit with cash forced server-side fails with 400 "Online channel requires online payment".
- [ ] Online → Paystack flow same as walk-in but order shows `[Online]` pill on kitchen card.

### Kitchen view differentiation

- [ ] In owner browser at `/food/orders` → guest order card shows pill:
  - Walk-in cash → `[Walk-in · T5]` (amber)
  - Online → `[Online]` (blue)
  - Resident orders → no pill
- [ ] Order_ref + items + total + payment line all render.
- [ ] Kitchen can advance status normally (no walk-in/online specific actions).

### Cross-tenant isolation

- [ ] Guest places order on tenant A. Open tenant B's `/food/orders` queue → does not see tenant A's order.
- [ ] Direct GET `/api/public/<wrong-slug>/food/orders/<id>?token=...` → 404.
- [ ] Token mismatch → 404 instead of order data.

### Repeat customer dedup

- [ ] Same phone number used twice on same tenant's `/order/<slug>` → second order links to the same `occupants.id` row.
  Verify via SQL: `select count(*) from occupants where tenant_id = '<id>' and phone = '0244000000';` → 1.

### Tenant admin QR section

- [ ] Open `/food/menu` as owner → QR section above menu editor.
- [ ] URL displayed matches `${app_url}/order/<slug>` (or custom_domain if set).
- [ ] "Copy" button puts URL on clipboard.
- [ ] "Download QR" downloads PNG. Scanning the PNG opens the public menu in a phone browser.

### Cancellation & refund

- [ ] Kitchen cancels a walk-in cash order → tracker shows red "Cancelled" banner; SMS with reason fires.
- [ ] Kitchen cancels an online+paid order → tracker shows cancelled; Paystack refund call logged in server logs.
- [ ] Online+unpaid abandoned >30 min → cron sweep flips to `cancelled` with reason "Payment not completed within 30 minutes".

### Realtime polling fallback

- [ ] Tracker poll every ~4s while order not in terminal state.
- [ ] Stop polling once `picked_up` or `cancelled`.

---

## Phase — Platform Super-Admin

Pre-requisites:
- A user in `platform_admins` (there's no self-service signup for this — insert directly, or via
  whatever the current internal onboarding process is).
- At least two tenants to exercise cross-tenant listing/impersonation.

- [ ] Log in as a platform admin → `/admin` loads on the platform root domain (`app.<domain>` or
      `localhost`), listing every tenant with plan/status/billing info.
- [ ] Visiting `/admin` on a tenant subdomain redirects to the platform root domain (middleware
      guard — see `pathname.startsWith('/admin')` handling).
- [ ] A non-platform-admin (even a tenant owner) hitting `/admin` directly does not see tenant data
      from other tenants.
- [ ] Suspend a tenant → that tenant's staff logging in land on `/suspended`, not `/dashboard`.
- [ ] Un-suspend → normal access restored.
- [ ] Impersonate a tenant (`/api/admin/impersonate`) → browsing shows that tenant's real data,
      `x-admin-impersonating` cookie set; the platform-admin identity is re-verified server-side
      each request (not just trusted from the cookie) — confirm by tampering with the impersonation
      cookie value in devtools and reloading: access should NOT be granted for an unverified admin.
- [ ] Stop impersonating → returns to the platform admin's own session, not logged out.
- [ ] Platform usage metrics page reflects real counts across tenants (not just the first one).

---

## Phase — Subscription Billing (Platform SaaS Plans)

Pre-requisites:
- Paystack test keys + `PAYSTACK_PLAN_*` env vars bootstrapped (see Prerequisites above).
- A test tenant on the free/trial plan.

- [ ] `/settings/billing` shows current plan, trial countdown (if on trial), and available plans.
- [ ] Subscribe to Starter (monthly) → Paystack checkout → success → plan updates immediately
      without waiting for the webhook (optimistic) and is confirmed by the webhook shortly after.
- [ ] Switch plan (Starter → Growth) → proration/change reflected; no duplicate active
      subscriptions in Paystack dashboard.
- [ ] Switch billing interval (monthly → annual) → discount applied per `.env.example`'s documented
      rates (quarterly 5%, 6-month 10%, yearly 15%).
- [ ] Cancel subscription → `/api/billing/cancel` — plan reverts to free/trial state at period end,
      not immediately (unless that's the intended UX — confirm against current copy).
- [ ] `/api/billing/reconcile` (or its cron) correctly resolves a tenant whose Paystack state and
      local `tenant_subscriptions` row have drifted (simulate by editing one directly).
- [ ] `/api/cron/trial-expiry` run manually — tenants past trial end without a paid plan flip to a
      restricted/suspended state; one with a paid plan is untouched.
- [ ] Non-owner role (manager, receptionist, ...) cannot access `/settings/billing` actions that
      mutate the subscription (view may be fine; mutation should be owner-gated).

---

## Phase — Accounting & Finance

Pre-requisites:
- A tenant with at least one confirmed booking with a recorded payment (so the journal has
  existing entries), and one manually-logged expense.

### Core ledger

- [ ] `/accounting/chart` lists the default chart of accounts (assets/liabilities/equity/
      revenue/expenses) seeded for a new tenant.
- [ ] `/accounting/journal` shows a debit/credit entry pair for the booking payment recorded in
      Phase 2 — debits and credits balance (sum to zero) for every entry.
- [ ] `/accounting/trial-balance` — total debits equal total credits for the period.
- [ ] `/accounting/pnl` for the current month shows the booking revenue and the logged expense.
- [ ] `/accounting/balance-sheet` — assets = liabilities + equity holds.
- [ ] `/accounting/cash-flow` groups the same payment by its real source (booking payment vs.
      manual expense).

### Expenses, budgets, AP/AR

- [ ] `/accounting/expenses` → log a new expense with a category → appears in P&L for that period.
- [ ] `/accounting/budgets` → set a budget for a category → actual-vs-budget reflects the logged
      expense.
- [ ] `/accounting/ap` (payables) and `/accounting/ar` (receivables) reflect outstanding supplier
      bills / occupant balances respectively.
- [ ] `/accounting/recurring` → a recurring expense template posts on its schedule (or via manual
      "run now" if that's exposed) without duplicating an already-posted period.

### Reconciliation & period close

- [ ] `/accounting/reconcile` → upload a bank statement CSV → matches against journal entries;
      unmatched rows are clearly flagged, not silently dropped.
- [ ] `/accounting/close` → closing a period blocks further postings into it (attempt to backdate
      an expense into a closed period and confirm it's rejected or requires an explicit override).
- [ ] `/accounting/depreciation` → an asset with a depreciation schedule posts its periodic
      depreciation entry to the journal.
- [ ] `/accounting/fx` → a transaction in a non-default currency converts using the rate from
      `/accounting/fx` (or `/api/accounting/fx-rates`) at time of posting, not today's rate.

### Access control

- [ ] Receptionist / housekeeper / security roles cannot reach any `/accounting/*` page (redirect,
      per the `ADMIN_ONLY_PATHS` guard in `middleware.ts`).
- [ ] Accountant role (if distinct from owner/manager) has the access level the product intends —
      confirm against current role definitions rather than assuming.

---

## Phase — Self Check-in (Public QR)

Pre-requisites:
- A confirmed booking with `self_checkin` enabled for the tenant (`/settings/self-checkin`).
- A Ghana Card (or configured ID type) image to upload.

- [ ] `/settings/self-checkin` toggle "Enabled" on for the tenant.
- [ ] Visit `/checkin/<slug>` (no login) → shows the tenant's available self-checkin flow.
- [ ] Submit ID documents (front + back) + confirm details → booking flips toward
      `pending_confirmation`/checked-in state per current design; room/bed hold reflects it
      (`room_occupancy_v` counts it, per the pending-payment-holds-a-bed logic).
- [ ] Staff `/bookings/self-checkins` inbox shows the new submission for confirmation.
- [ ] Staff confirms → booking fully checked in; occupant portal reflects it.
- [ ] Abandoned self-checkin (submitted but never confirmed) older than the stale-release window
      frees the held bed — trigger via `release_stale_self_checkin_reservations` (service-role
      only as of migration 117; don't test this by calling the RPC directly as a regular user,
      that's exactly what's now blocked).
- [ ] Self-checkin on an already-checked-in or cancelled booking is rejected, not silently accepted.

---

## Phase — Security, Assets & Lost & Found

- [ ] `/security/visitors` → log a visitor pass; check-out timestamp recorded on visitor leaving.
- [ ] `/security/blacklist` → blacklist an occupant with a reason and expiry → their profile page
      shows a blacklist banner; expiry date past → banner clears (or is marked expired, per current
      design) without manual intervention.
- [ ] `/security/keys` → issue a physical key to an occupant/room; mark returned; a key shown as
      "issued" for a checked-out booking is visible as an outstanding-key flag somewhere (don't
      let it get silently lost from tracking).
- [ ] `/assets` → register an asset (category, brand, serial) → QR code generates; scanning it
      (or visiting the QR's target URL directly) opens that asset's detail page.
- [ ] Mark an asset "under maintenance" / "disposed" / "lost" → status reflected in the list and
      detail view.
- [ ] `/lost-found` → log a found item, later mark it claimed/returned, optionally linked to an
      occupant.

---

## Phase — Reports, Intelligence & AI Assistant

- [ ] `/reports` standard reports (occupancy, revenue, housekeeping, staff) render non-empty data
      for a tenant with real activity.
- [ ] `/reports/custom` → pick a metric + date range + group-by → results table renders; CSV export
      downloads and the CSV content matches what's on screen.
- [ ] `/reports/schedules` → a scheduled report actually fires on its cadence
      (`/api/report-schedules/run`, or the cron that calls it) and is delivered via the configured
      channel.
- [ ] `/reports/debt-aging`, `/reports/retention`, `/reports/revenue`, `/reports/staff-revenue`,
      `/reports/feedback` each load without error for a tenant with relevant data.
- [ ] `/intelligence/anomalies` → after seeding an obviously anomalous pattern (e.g. a sudden
      occupancy drop or payment spike), the anomaly appears; `/api/cron/anomaly-check` run manually
      confirms detection isn't purely reliant on the UI's own polling.
- [ ] `/ai` → ask "What rooms are available this weekend?" and "What's our revenue this month?" —
      responses reflect real tenant data, not hallucinated numbers (spot-check one answer against
      the actual dashboard figures).
- [ ] AI assistant refuses or safely handles a question about a different tenant's data if asked
      (it should have no way to access it, but worth confirming the tool-calling layer is scoped).
- [ ] AI escalate-to-human path (if configured) actually notifies a real staff member.

---

## Phase — Messaging (Staff, Broadcast, Group)

Distinct from the maintenance-request threading covered above — this is general in-app messaging.

- [ ] Staff-to-staff direct message: two staff accounts, message sent from one appears live in the
      other's `/messages` view without refresh.
- [ ] `/messages/broadcast` → hostel-wide announcement reaches all active occupants' message list.
- [ ] `/messages/group` → a group conversation with a subset of participants only shows to those
      participants — a staff member not in the group cannot see or read it (this is exactly the
      class of bug fixed in migration 115's RLS recursion fix — worth explicitly re-confirming
      participant isolation still holds after any future messaging change).
- [ ] Occupant-to-occupant DMs respect the tenant's `inter_occupant_dm_enabled` toggle — off means
      the feature is unreachable, not just hidden in the UI.
- [ ] File attachment upload/read follows the same participant-only access as text messages.

---

## Phase — Booking Widget (Embeddable)

Pre-requisites:
- `/settings/widget` configured and enabled for a test tenant.

- [ ] Embed the generated `<script>`/iframe snippet on a plain HTML test page (not the app itself).
- [ ] Widget loads the tenant's available room categories via `/api/widget/<slug>/rooms` — no
      authentication, no other tenant's data visible from the same embed code path.
- [ ] Submit a booking through the widget (`/api/widget/<slug>/book`) → booking appears in the
      tenant's admin `/bookings` list with source `widget`.
- [ ] Widget on a domain not matching the tenant's registered `website_url` — confirm current
      behavior matches intent (this is the same origin-check pattern documented in
      `docs/external-enquiry-snippet.md` for the enquiry form; verify the booking widget follows
      an equivalent check, or note here if it currently doesn't).

---

## Feature Coverage Map

What has a phase in this document vs. what doesn't yet. Update this whenever you add, remove, or
retire a phase — the point of this table is to make gaps visible instead of silently stale.

| Area | Covered? |
|---|---|
| Signup, onboarding, auth | ✅ Phase 1 |
| Rooms, bookings, occupants, invoices (core) | ✅ Phase 2 |
| Occupant portal (home, payments, maintenance, notices, settings) | ✅ Phase 3 |
| Staff portal (tasks, requests, profile) | ✅ Phase 4 |
| Public booking page | ✅ Phase 5 |
| Access control / role routing | ✅ Phase 6 |
| Communications / notices | ✅ Phase 7 |
| Bank draft payments | ✅ dedicated phase |
| Occupant invoice viewing/download | ✅ dedicated phase |
| Real-time maintenance threading | ✅ dedicated phase |
| Food ordering (resident + kitchen) | ✅ dedicated phase |
| Public food ordering (walk-in QR + online) | ✅ dedicated phase |
| Platform super-admin | ✅ dedicated phase |
| Subscription billing (SaaS plans) | ✅ dedicated phase |
| Accounting & finance | ✅ dedicated phase (not exhaustive — this module is large) |
| Self check-in | ✅ dedicated phase |
| Security, assets, lost & found | ✅ dedicated phase |
| Reports, anomaly detection, AI assistant | ✅ dedicated phase |
| General messaging (staff/broadcast/group) | ✅ dedicated phase |
| Embeddable booking widget | ✅ dedicated phase |
| HR: payroll, shifts, attendance, leave, performance | ⚠️ not covered |
| Housekeeping (tenant-side task board) | ⚠️ partially — only via staff portal's task-completion flow in Phase 4 |
| Preventive maintenance schedules + meter readings | ⚠️ not covered |
| Portfolio (multi-property owner view) | ⚠️ not covered |
| Waiting list | ⚠️ not covered |
| Bulk import (bookings/occupants/rooms) | ⚠️ not covered |
| Booking renewals | ⚠️ not covered |
| Roommate matching | ⚠️ not covered |
| Revenue points / walk-in patronage | ⚠️ not covered |
| Shift closeout | ⚠️ not covered |
| ID verification queue | ⚠️ not covered |
| Kiosk mode | ⚠️ not covered |
| Daily/weekly digest emails | ⚠️ not covered |
| Website CMS / public site builder | ⚠️ not covered |
| Mobile app (`feat/mobile-app` branch) | ⚠️ not merged to `main` yet — out of scope until it is |

If you pick up one of the ⚠️ rows, add a phase for it above and flip this row to ✅ in the same PR.

