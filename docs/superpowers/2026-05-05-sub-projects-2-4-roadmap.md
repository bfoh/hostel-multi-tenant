# Student Portal — Sub-Projects 2-4 Roadmap

**Status:** scope + decisions surfaced; each sub-project needs its own brainstorming pass + spec + plan before implementation
**Date:** 2026-05-05
**Parent:** original brainstorming covered four sub-projects. Sub-project 1 (payments + bank-draft) shipped to production as PR #1 / merge `e1b7299`.

---

## Why a roadmap before per-project specs

Sub-project 1 took ~25 commits and surfaced ~13 review-caught bugs over a single session. Each of SP 2-4 carries similar weight. This document:

1. Locks scope so we don't accidentally re-grow them mid-build
2. Surfaces the **open decisions** that need brainstorming before each spec is written (asking these now would re-do the brainstorming-skill question loop without the back-and-forth — better to flag them)
3. Sketches the schema + component surface so the cost is visible up front
4. Recommends sequencing

Per-project specs will go to `docs/superpowers/specs/`; per-project plans to `docs/superpowers/plans/` — same pattern as SP 1.

---

## Cross-cutting infrastructure (already shipped, reusable)

These were built or hardened during SP 1 and apply across SP 2-4:

| Capability | Where |
|---|---|
| Realtime subscriptions on `booking_payments` | `lib/supabase/client.ts` + pattern in `draft-queue.tsx` |
| Web push dispatch to a tenant | `lib/push.ts` → `sendPushToTenant(tenantId, payload)` |
| SMS dispatch via Arkesel | `lib/sms.ts` typed helpers + `lib/notifications/render.ts` template lookup |
| Tenant-side role gate | `lib/auth/tenant-role.ts` → `requireTenantRole(tenantId, ['owner', 'accountant'])` (DB-authoritative) |
| Occupant session resolver | `lib/auth/occupant-session.ts` → `getOccupantSession()` |
| Private-bucket signed URLs | pattern in `lib/bank-draft.ts` → `getSignedDraftUrl(path, ttl)` |
| Slide-over review panel UX | pattern in `components/payments/draft-review-panel.tsx` |
| Sidebar live-count badge | pattern in `components/payments/sidebar-draft-badge.tsx` (collapsed dot + expanded pill) |
| `after()` fire-and-forget for notifications | pattern in `app/api/occupant/bank-draft/route.ts` |
| Optimistic-lock UPDATE returning affected rows | pattern in admin approve/reject/undo routes |

**Don't rebuild any of these.** Each sub-project should import / adapt.

---

## Sub-Project 2 — Invoice viewing & download

**Estimate:** 1 working day. Smallest of the three.

### Goal

Let students see their invoices in the portal and download them as PDF — using the existing tenant-side PDF infrastructure (`@react-pdf/renderer` already wired up at `/api/invoices/[id]/pdf`).

### Non-goals

- Editing invoices (admin-only)
- Per-line-item disputes
- Invoice payment online (already handled by SP 1's PayNowButton on the payments page — invoices and payments share the booking record)

### Existing surface

Tenant side: `/(tenant)/invoices/[id]/page.tsx` + `/api/invoices/[id]/pdf/route.ts` already render invoices via `getInvoiceById()` (where "invoice" is really the booking row joined with line-item-shaped data).

No occupant-side invoice routes today. Occupant portal at `/occupant-portal/payments` shows balance but doesn't list invoices as discrete documents.

### Open decisions (need brainstorming before spec)

1. **What IS an invoice from the student's perspective?** Currently each booking generates one PDF on demand. Options:
   - One invoice per booking (current tenant-side behavior — simplest)
   - One invoice per semester / billing period (requires schema change)
   - Multiple invoices per booking (e.g. fees + utilities split)
2. **Listing UI:** card grid? table? chronological feed?
3. **Download permission:** can a student download a paid+confirmed invoice forever, or only while booking is active?
4. **Tax considerations:** GRA-compliant invoices have legal numbering (`HMS-YYYY-N`) — should occupant view show that number prominently? PDF already includes it.
5. **Cancelled bookings:** should the student see/download invoices for cancelled bookings?

### Sketch

**New routes:**
- `/(occupant-portal)/occupant-portal/invoices/page.tsx` — list view
- `/(occupant-portal)/occupant-portal/invoices/[id]/page.tsx` — detail view (or embed)
- `/api/occupant/invoices/[id]/pdf/route.ts` — wraps existing `InvoicePDF` renderer, gates by occupant ownership
- Maybe `/api/occupant/invoices/route.ts` — list endpoint, or fetch in server component

**New components:**
- `components/occupant-portal/invoice-list.tsx`
- `components/occupant-portal/invoice-card.tsx`

**Modifications:**
- `components/occupant-portal/bottom-nav.tsx` — add "Invoices" tab
- `app/(occupant-portal)/occupant-portal/page.tsx` — quick-link tile

**No new schema.** Reuses bookings + existing tax columns. No new RLS — bookings already have occupant SELECT policies.

### Risks
- Low. PDF infra battle-tested, schema unchanged, just a portal-side surface.

---

## Sub-Project 3 — Real-time issue reporting

**Estimate:** 4-5 working days. Largest of the three until food ordering.

### Goal

Replace the current one-shot `/api/occupant/maintenance` POST with a **threaded, real-time conversation** between the resident and admin, anchored on a maintenance request. Resident reports issue with photos; admin replies, asks for clarification, marks status changes; both sides see updates live.

### Non-goals (initial scope)

- Voice / video messages
- Read receipts
- @mentions of specific staff (any owner/manager/maintenance staff sees the conversation)
- Knowledge base / canned responses (separate later feature)
- Internal admin-only notes hidden from resident (could be Phase 2)

### Existing surface

- Single endpoint `/api/occupant/maintenance` (POST creates request)
- Tenant side: full maintenance module at `/(tenant)/maintenance/...`
- No threading, no realtime, no occupant-side replies, no per-request status visibility on portal

### Open decisions (need brainstorming before spec)

1. **Reply model:** flat list of messages on a request? Threaded sub-replies? Twitter-style timeline?
2. **Status changes:** does an admin status change (e.g. `open` → `in_progress`) appear inline in the conversation as a system message? Or only as a status badge?
3. **Photo attachments:** how many per message? same 5 MB limit as bank drafts? Multiple files in one message?
4. **Push notifications:** every message → push? Or only initial submission + status change + first response?
5. **SMS notifications:** SMS for every reply quickly gets expensive. Only on status change? Only on resident's first reply after admin assignment? Configurable per-tenant?
6. **Closing a request:** can resident close their own request? Reopen?
7. **Priority escalation:** can admin bump priority? Does that trigger a different notification?
8. **Occupants without active booking:** can a former resident still file an issue (e.g. about deposit refund delay)? Or hard cutoff at checkout?
9. **Anonymous reports:** allowed? (Spec sub-project says "report any issue to admin" — could include security/harassment reports where anonymity matters.)
10. **Multi-tenant:** if a building has multiple hostel sub-tenants on shared infra, who sees what? (Probably out of scope — current architecture is one tenant per hostel.)

### Sketch

**New schema (1 migration):**

```sql
-- New table: per-request message thread
create table maintenance_messages (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  request_id      uuid not null references maintenance_requests(id) on delete cascade,
  author_user_id  uuid references auth.users(id),
  author_kind     text not null check (author_kind in ('occupant', 'staff', 'system')),
  body            text check (char_length(body) <= 2000),
  attachments     text[] default array[]::text[],   -- storage paths
  created_at      timestamptz not null default now()
);

create index on maintenance_messages (tenant_id, request_id, created_at);

-- RLS: occupant sees only messages on their own requests; staff sees all in tenant.
-- Realtime: enabled on this table.

-- Optional: extend maintenance_requests with `last_message_at` for sort order.
```

**New storage bucket:** `maintenance-attachments` (private, 10 MB limit, image + PDF allowlist).

**New routes:**
- `POST /api/occupant/maintenance/[id]/messages` — occupant reply
- `GET /api/occupant/maintenance/[id]` — fetch request + thread
- `POST /api/maintenance/[id]/messages` — staff reply
- `PATCH /api/maintenance/[id]/status` — already exists; extend to insert a system message on change
- `POST /api/occupant/maintenance/[id]/close` — occupant-initiated close (if decision allows)

**New components:**
- `components/occupant-portal/maintenance-thread.tsx` (realtime subscription)
- `components/occupant-portal/maintenance-message-form.tsx`
- `components/maintenance/staff-message-form.tsx`
- `components/maintenance/conversation-view.tsx` (admin side)

**Modifications:**
- `/(occupant-portal)/occupant-portal/maintenance/[id]/page.tsx` (new) — wraps thread
- Tenant maintenance detail page — embed conversation alongside existing form

### Risks
- Medium. Realtime channel-per-request OR one-channel-per-tenant filtered by `request_id` — needs a decision (per-request scales better but more channels).
- Notification noise (every message → push) is the most likely UX failure.
- Photo upload + thumbnailing for inline preview adds work.

---

## Sub-Project 4 — Food ordering + service privileges

**Estimate:** 7-10 working days. Largest. Whole new module.

### Goal

Two intertwined capabilities:

1. **Food ordering:** students browse a menu published by the hostel kitchen, place orders (single-item or multi-item carts), pay (account credit / online), kitchen sees orders in real time and marks ready.
2. **Service privileges:** abstract framework for any service the hostel offers — laundry slots, study room reservations, gym passes, etc. Could be its own sub-project later, OR a generalised pattern that food ordering inherits from.

### Non-goals (initial scope)

- Third-party delivery (Uber Eats / Bolt Food integration)
- Real-time kitchen capacity / time-slot pre-orders
- Nutritional info, allergen tagging
- Tipping
- Customisable items (e.g. "no onions" — nice to have, not first cut)
- Service catalog beyond food (laundry / gym) — defer to a follow-up sub-project unless we build the abstraction now

### Open decisions (need brainstorming before spec)

The biggest set of any sub-project. Major buckets:

#### Menu & catalog
1. **Menu structure:** flat list, or categories (mains / drinks / snacks)?
2. **Multi-day menu:** one menu always-on, or daily menu (today's special) with publish date?
3. **Availability:** sold-out flag? Stock count? Just toggle on/off?
4. **Pricing:** GHS only? Per-tenant? Time-based pricing (breakfast/lunch/dinner)?
5. **Photos:** required per item? Optional?

#### Ordering & cart
6. **Cart:** persistent across sessions, or session-only?
7. **Single-item vs multi-item orders:** simpler to ship single-item; multi-item is the "real" UX
8. **Order timing:** order-and-eat-now only, or scheduled for later (e.g. order breakfast tonight for 7am tomorrow)?
9. **Quantity limits:** max items per order?
10. **Cut-off times:** e.g. lunch orders close at 11am

#### Payment
11. **Payment method:** charge to room (debit booking balance), pay online (Paystack), pay in person (cash on delivery)?
12. **Refunds on cancellation:** auto-credit the booking? Manual?

#### Fulfillment
13. **Order states:** placed → preparing → ready → picked-up → completed? Different model?
14. **Kitchen UI:** new admin page? Reuse staff portal pattern?
15. **Pickup vs delivery:** room delivery? Counter pickup? Both?
16. **Realtime alerts:** push to kitchen device on new order? Audio chime?
17. **SMS to student when ready:** yes/no?

#### Reporting
18. **Daily totals:** integrate with existing `revenue_points` module? Separate?
19. **Most-ordered items:** stretch goal?

#### Service privileges (if bundled)
20. **Generalised service framework:** food = one service type. Laundry/gym = others. Build abstraction now or defer?

### Sketch

**New schema (likely 2-3 migrations):**

```sql
-- Migration A: catalog
create table menu_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  sort_order smallint default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  category_id uuid references menu_categories(id) on delete set null,
  name text not null,
  description text,
  price_pesewas integer not null check (price_pesewas > 0),
  photo_url text,
  is_available boolean default true,
  sort_order smallint default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Migration B: orders
create type food_order_status as enum (
  'placed', 'preparing', 'ready', 'picked_up', 'cancelled'
);

create table food_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  occupant_id uuid not null references occupants(id),
  booking_id uuid references bookings(id),
  status food_order_status not null default 'placed',
  total_pesewas integer not null,
  payment_method text check (payment_method in ('online', 'room_charge', 'cash_on_pickup')),
  payment_id uuid references booking_payments(id),
  scheduled_for timestamptz,   -- null = ASAP
  notes text,
  placed_at timestamptz default now(),
  ready_at timestamptz,
  picked_up_at timestamptz,
  cancelled_at timestamptz,
  cancelled_reason text
);

create table food_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references food_orders(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id),
  quantity smallint not null check (quantity > 0),
  unit_price_pesewas integer not null,   -- snapshotted at order time
  subtotal_pesewas integer not null
);

-- Migration C: storage bucket for menu photos (public bucket since photos shown on portal)
```

**New storage bucket:** `menu-photos` (public, 2 MB cap, image-only).

**New routes (occupant side):**
- `GET /occupant-portal/food` — menu page
- `POST /api/occupant/food-orders` — place order
- `DELETE /api/occupant/food-orders/[id]` — cancel (if status='placed')
- `GET /api/occupant/food-orders/[id]` — order detail / status

**New routes (tenant side):**
- `/(tenant)/food/menu` — menu management (CRUD items + categories)
- `/(tenant)/food/orders` — kitchen queue, realtime
- `POST /api/food-orders/[id]/status` — kitchen marks preparing/ready/picked-up

**New components (~10):**
- Menu list + category sections (occupant)
- Cart drawer / sheet (occupant)
- Order placement flow (occupant)
- Order tracker (occupant)
- Menu CRUD (admin)
- Kitchen queue (admin, realtime)
- Order card (admin)

**Modifications:**
- Sidebar: Food Orders entry for owner/manager
- Bottom nav: Food tile for occupant
- Revenue points integration if room-charge selected

### Risks
- High. Whole new domain. Cart UX has many edge cases (quantity changes, item removed by admin mid-cart, etc.).
- Payment flow integration with `booking_payments` (room-charge → debit balance) needs care — same trigger that auto-updates `paid_amount` on `success` would mistakenly subtract food charges from rent.
- Service privileges abstraction: if built, doubles complexity. **Recommend: defer service framework. Build food first as concrete module. Generalise later if/when laundry or gym join.**

---

## Recommended sequencing

| # | Sub-project | Days | Why this order |
|---|---|---|---|
| 1 | Payments + bank-draft | (DONE) | Highest user-facing value, smallest surface |
| 2 | Invoice viewing & download | 1 | Trivial — reuses PDF infra entirely. Quick win. |
| 3 | Real-time issue reporting | 4-5 | Builds on realtime + push patterns from SP 1. Higher friction reduction than food. |
| 4 | Food ordering | 7-10 | Whole new module. Build last so the team is fluent in realtime / RLS / role-gate patterns. |

**Total remaining estimate: 12-16 working days** at the same care level as SP 1 (full two-stage code review, react to findings, no shortcuts).

---

## Per-sub-project workflow

For each, repeat the SP 1 process:

1. **Brainstorming session** — answer the open decisions above one at a time. Use the visual companion for UI questions. (~30-45 min per sub-project)
2. **Spec written** to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
3. **Plan written** to `docs/superpowers/plans/YYYY-MM-DD-<topic>.md` with task-by-task breakdown
4. **Subagent-driven implementation** with bundle batching (proven cost-effective from SP 1)
5. **Two-stage review per bundle** (spec compliance, then code quality)
6. **Migrations queued for manual application** (Supabase prod DB)
7. **PR + production deploy via main merge**

Skip steps 4-7 only if you want a quick draft / experimental implementation; for production code keep all of them.

---

## Decisions you should make BEFORE the next brainstorming session

To save round-trips, three meta-decisions affecting all three sub-projects:

| Q | Options | My recommendation |
|---|---|---|
| Should service privileges (laundry / gym / etc.) be a generic framework, or each its own module? | Generic vs modular | **Modular.** Build food ordering concrete; only generalise if a 3rd service type joins. |
| Should occupant push/SMS for issue replies be opt-in per-occupant, opt-in per-tenant, or always-on? | Per-occupant / per-tenant / always-on | **Per-tenant default with per-occupant override.** Reuses existing `notification_templates` per-tenant pattern. |
| For food orders, should "charge to room" debit `bookings.paid_amount` or live in a separate ledger? | Same `booking_payments` infra / separate `food_charges` table | **Separate ledger.** Mixing food charges with rent on one ledger breaks the `paid_amount` semantic and confuses the receipt PDF. New `food_charges` table that posts to its own GL account. |

If you agree with these defaults, the brainstorming sessions move ~3 questions faster each.

---

## Next action

Pick one:

A. **Brainstorm SP 2 now** (invoice viewing — quick, ~20 min). Smallest, highest signal-to-effort.
B. **Brainstorm all three back-to-back** to get specs before any building. Higher upfront time, locks scope.
C. **Defer.** Use this roadmap as visibility into the work; revisit when ready.

Sub-project specs and plans go straight to git. Production deploys land via the same merge-to-main flow as SP 1.
