# Food Ordering — Design Spec

**Sub-project 4 of 4** — Roadmap: `docs/superpowers/2026-05-05-sub-projects-2-4-roadmap.md`

**Date:** 2026-05-06

**Goal:** Students browse a daily menu published by the hostel kitchen, place multi-item orders, pay online (Paystack) or cash-on-pickup, kitchen sees orders in real time and marks them through `placed → preparing → ready → picked_up`. Pickup only.

**Non-goals (initial scope):**
- Room delivery
- Third-party delivery (Uber Eats / Bolt Food)
- Scheduled / pre-orders for later
- Customisable items ("no onions")
- Tipping
- Nutritional info / allergen tagging
- Stock counts
- Time-based pricing (breakfast/lunch/dinner)
- Top-items dashboard
- Service-privileges abstraction (laundry/gym/etc.) — deferred to separate sub-project
- Room-charge payment method (avoids `paid_amount` trigger collision with rent)

---

## Locked decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Menu structure | Categories (mains/drinks/snacks) |
| 2 | Multi-day | Daily publish (today's menu) |
| 3 | Availability | Toggle on/off + sold_out flag |
| 4 | Pricing | Per-tenant pesewas |
| 5 | Photos | Optional |
| 6 | Cart persistence | Persistent across sessions |
| 7 | Items per order | Multi-item |
| 8 | Order timing | ASAP only |
| 9 | Quantity cap | Max 10 per item per order |
| 10 | Cut-off times | Per-tenant config, default none |
| 11 | Payment methods | Online (Paystack) + cash_on_pickup |
| 12 | Refunds | Paystack refund (online); no charge (cash) |
| 13 | Order states | placed → preparing → ready → picked_up + cancelled |
| 14 | Kitchen UI | New realtime queue page |
| 15 | Fulfillment | Pickup only |
| 16 | Realtime alerts | Push to kitchen, no audio |
| 17 | SMS when ready | Yes, tenant-configurable |
| 18 | Reporting | Integrate via `revenue_points` |
| 19 | Top items | Defer |
| 20 | Service abstraction | Defer entirely |

---

## Architecture overview

### Schema (3 migrations)

#### Migration A — Menu catalog

```sql
create table menu_categories (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  sort_order  smallint not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index on menu_categories (tenant_id, sort_order);

create table menu_items (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  category_id     uuid references menu_categories(id) on delete set null,
  name            text not null,
  description     text check (char_length(coalesce(description, '')) <= 500),
  price_pesewas   integer not null check (price_pesewas > 0),
  photo_url       text,
  is_available    boolean not null default true,   -- admin toggle
  is_sold_out     boolean not null default false,  -- temporary daily flag
  publish_date    date,                            -- null = always-on; set = "today's menu"
  sort_order      smallint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index on menu_items (tenant_id, publish_date, is_available, sort_order);
```

`publish_date` distinguishes "today's special" from always-on items. Daily menu workflow: admin sets `publish_date = today` for daily items; always-on items leave `publish_date = null`. Occupant menu query filters: `is_available = true AND is_sold_out = false AND (publish_date is null OR publish_date = current_date)`.

RLS: `tenant_members` read all; `occupants` read only `is_available = true` items in their tenant.

#### Migration B — Orders

```sql
create type food_order_status as enum (
  'placed', 'preparing', 'ready', 'picked_up', 'cancelled'
);

create type food_payment_method as enum ('online', 'cash_on_pickup');

create table food_orders (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  occupant_id       uuid not null references occupants(id),
  booking_id        uuid references bookings(id),
  order_ref         text not null,                       -- short human ref e.g. "F-A4B"
  status            food_order_status not null default 'placed',
  total_pesewas     integer not null check (total_pesewas > 0),
  payment_method    food_payment_method not null,
  paystack_reference text,                               -- set after Paystack callback
  paid_at           timestamptz,
  placed_at         timestamptz not null default now(),
  preparing_at      timestamptz,
  ready_at          timestamptz,
  picked_up_at      timestamptz,
  cancelled_at      timestamptz,
  cancelled_reason  text,
  notes             text check (char_length(coalesce(notes, '')) <= 280)
);

create unique index food_orders_ref on food_orders (tenant_id, order_ref);
create index on food_orders (tenant_id, status, placed_at);
create index on food_orders (tenant_id, occupant_id, placed_at desc);

create table food_order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references food_orders(id) on delete cascade,
  menu_item_id        uuid not null references menu_items(id),
  name_snapshot       text not null,                    -- snapshot at order time
  quantity            smallint not null check (quantity between 1 and 10),
  unit_price_pesewas  integer not null check (unit_price_pesewas > 0),
  subtotal_pesewas    integer not null check (subtotal_pesewas > 0)
);

create index on food_order_items (order_id);

-- Realtime publication
alter publication supabase_realtime add table food_orders;
```

`order_ref` short human-readable ID (e.g. `F-A4B7`) for kitchen + SMS. Generated server-side at insert.

RLS:
- `food_orders` read: occupant sees own; staff sees tenant.
- `food_order_items` read: same join via order_id.
- All writes via service-role routes.

#### Migration C — Storage bucket

```sql
insert into storage.buckets (id, public, file_size_limit, allowed_mime_types)
values (
  'menu-photos',
  true,            -- public read; menu shown to all logged-in occupants
  2 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
);
```

Public bucket. Path: `<tenant_id>/menu/<menu_item_id>/<filename>`.

#### Migration D — Tenant settings (could fold into B)

```sql
alter table tenants
  add column if not exists food_orders_enabled  boolean not null default false,
  add column if not exists food_cutoff_time     time,                         -- null = no cutoff
  add column if not exists food_ready_sms       boolean not null default true;
```

---

## API surface

### Occupant routes

| Verb | Path | Behavior |
|---|---|---|
| `GET`    | `/api/occupant/food/menu` | Today's menu grouped by category |
| `GET`    | `/api/occupant/food/cart` | Persisted cart for current occupant (uses `food_carts` JSON or session?) — see Cart Storage below |
| `POST`   | `/api/occupant/food/cart` | Replace cart contents |
| `POST`   | `/api/occupant/food-orders` | Place order from cart; returns Paystack init for online or order id for cash |
| `GET`    | `/api/occupant/food-orders/[id]` | Order detail + items + status |
| `DELETE` | `/api/occupant/food-orders/[id]` | Cancel if status = `placed`. Triggers Paystack refund if online + paid. |

### Tenant routes

| Verb | Path | Behavior |
|---|---|---|
| `GET/POST/PATCH/DELETE` | `/api/menu/categories[/[id]]` | CRUD, owner/manager |
| `GET/POST/PATCH/DELETE` | `/api/menu/items[/[id]]` | CRUD, owner/manager. PATCH supports `is_available`, `is_sold_out` for kitchen toggle. |
| `POST` | `/api/menu/items/[id]/photo` | Multipart upload to `menu-photos` bucket |
| `PATCH` | `/api/food-orders/[id]/status` | Kitchen advances status. Allowed transitions enforced server-side. Triggers SMS on `ready`. |

### Paystack callback

`POST /api/payments/paystack/webhook` (existing) — extend to handle food order references via `metadata.kind = 'food_order'` so `paid_at` lands on `food_orders` not `booking_payments`.

---

## Cart storage

**Choice: server-side persistent cart in a new `food_carts` table.**

```sql
create table food_carts (
  occupant_id  uuid primary key references occupants(id) on delete cascade,
  tenant_id    uuid not null references tenants(id) on delete cascade,
  items        jsonb not null default '[]'::jsonb,   -- [{menu_item_id, quantity}]
  updated_at   timestamptz not null default now()
);
```

JSON shape kept thin — no price snapshot in cart (computed at order placement). Cart cleared on successful order placement.

---

## Components

### Occupant side

| Path | Type | Responsibility |
|---|---|---|
| `app/(occupant-portal)/occupant-portal/food/page.tsx` | Server | Today's menu grouped by category |
| `app/(occupant-portal)/occupant-portal/food/cart/page.tsx` | Server | Cart review + place-order CTA |
| `app/(occupant-portal)/occupant-portal/food/orders/[id]/page.tsx` | Server | Order tracker (status pill + items) |
| `components/occupant-portal/food/menu-item-card.tsx` | Client | Item card with quantity selector + add-to-cart |
| `components/occupant-portal/food/cart-drawer.tsx` | Client | Bottom-sheet drawer summarising cart on menu page |
| `components/occupant-portal/food/order-tracker.tsx` | Client | Realtime status updates (`food_orders` filter `id=eq.X`) |
| `components/occupant-portal/food/payment-method-picker.tsx` | Client | online vs cash_on_pickup, kicks Paystack init for online |

### Tenant side

| Path | Type | Responsibility |
|---|---|---|
| `app/(tenant)/food/menu/page.tsx` | Server | Category + item management |
| `app/(tenant)/food/orders/page.tsx` | Server | Realtime kitchen queue shell |
| `components/food/menu-editor.tsx` | Client | CRUD UI |
| `components/food/order-queue.tsx` | Client | Realtime list, columns by status |
| `components/food/order-card.tsx` | Client | One order: items, status, action buttons (advance / cancel) |
| `components/food/photo-upload.tsx` | Client | Drag-drop photo upload to bucket |

### Helpers

| Path | Responsibility |
|---|---|
| `lib/food/menu.ts` | `getTodaysMenu(tenantId)`, `getMenuItem(id)` |
| `lib/food/orders.ts` | `placeOrder`, `advanceStatus`, `cancelOrder`, `generateRef`, refund integration |
| `lib/food/cart.ts` | `getCart`, `setCart`, `clearCart` |
| `lib/food/refund.ts` | Paystack refund call wrapper |

---

## Notification matrix

| Event | Push | SMS |
|---|---|---|
| Order placed | Push to all kitchen staff (owner/manager/housekeeper/receptionist) | — |
| Status: preparing | — | — (nice-to-have v2) |
| Status: ready | Push to occupant | SMS to occupant if `food_ready_sms = true` |
| Order cancelled by occupant | Push to kitchen | — |
| Order cancelled by kitchen | Push to occupant | SMS to occupant |

SMS templates added to `lib/notifications/defaults.ts`:
- `food_order_ready`
- `food_order_cancelled`

---

## Payment flow

### Online (Paystack)

1. Occupant submits cart → `POST /api/occupant/food-orders`.
2. Server creates `food_orders` row with `payment_method = 'online'`, `status = 'placed'`, no `paid_at`.
3. Server creates Paystack init session. `metadata.kind = 'food_order'` + `metadata.order_id`.
4. Returns `{ authorization_url }` to client.
5. Client redirects to Paystack.
6. Paystack callback hits webhook → server marks `paid_at = now()`, `paystack_reference`, dispatches kitchen push.
7. If user abandons: order stays at `placed` with no `paid_at`. Cron sweeps and marks `cancelled` after 30 min unpaid.

### Cash on pickup

1. Order created with `payment_method = 'cash_on_pickup'`. Kitchen push fires immediately.
2. Kitchen marks `picked_up` → no payment record needed at this point. Manual cash collection logged separately (defer integration to `revenue_points` v2).

### Refunds

- Online + paid + cancelled: Paystack refund API call, log `cancelled_at`. Refund timing follows Paystack (typically 5-7 business days).
- Cash + cancelled before pickup: no money moved, no action.
- Online + unpaid + cancelled: just mark cancelled.

---

## Order state machine

```
placed ──┬─→ preparing ──→ ready ──→ picked_up
         │       │            │
         │       └─→ cancelled ←─┘
         └─→ cancelled
```

- Occupant can cancel only at `placed`.
- Staff can cancel from `placed` or `preparing` (e.g. ran out of ingredients).
- `ready → cancelled` allowed (rare: occupant no-show after ready). Triggers refund.
- `picked_up` is terminal.

State transitions enforced server-side in `lib/food/orders.ts` `advanceStatus()`.

---

## Realtime channels

- **Occupant order tracker:** `food-orders:<order_id>` filter `id=eq.<order_id>`. Subscribes for status row updates.
- **Kitchen queue:** `food-orders:tenant:<tenant_id>` filter `tenant_id=eq.<tenant_id>` AND `status=in.(placed,preparing,ready)` (filter applied client-side; server filter is just `tenant_id`).

---

## Reporting integration

`food_orders.total_pesewas` posted to `revenue_points` on `picked_up` transition. New revenue category `'food'`. Only `paid_at` orders count toward revenue (cash orders count at pickup; online orders count at paid).

Defer dashboard widget to follow-up. The data lands in the existing reporting tables; chart UI later.

---

## Settings

New tenant settings tab `/settings/food`:
- `food_orders_enabled` toggle
- `food_cutoff_time` (TimeInput)
- `food_ready_sms` toggle

Bottom-nav "Food" tile on occupant portal hides when `food_orders_enabled = false`.

---

## Out of scope (deferred)

- Room-charge as payment method (collision risk with rent `paid_amount` trigger)
- Stock count
- Time-based pricing
- Top-items dashboard
- Service-privileges abstraction
- Customisable items
- Allergen tagging
- Audio chime on kitchen page
- Scheduled / pre-orders

---

## Risks

- **Cart race conditions:** item goes sold-out between cart add and order submit. Server validates each item at submit; rejects with `409` listing failed items. Cart UI shows "remove unavailable" affordance.
- **Paystack webhook reliability:** webhook may be delayed or fail. The cron sweep at 30 min handles abandoned `placed` orders. Webhook idempotent on `paystack_reference`.
- **Order ref collision:** 4-char alphanumeric ref has ~1.6M space. Per-tenant uniqueness is fine (`unique (tenant_id, order_ref)`). Insert with retry on conflict.
- **Photo bucket abuse:** public bucket, but path scheme requires authoring via `/api/menu/items/[id]/photo` admin route. Direct uploads rejected by RLS.
- **Refund latency:** Paystack refunds are async. UI shows "Refund in progress" and auto-updates when webhook confirms refund.
- **High volume kitchen UX:** at >50 concurrent orders, the queue may get crowded. Add per-status filter pills (defer if needed).

---

## Implementation phases (preview — full plan in writing-plans step)

| Phase | Focus | Tasks (approx) |
|---|---|---|
| 0 | Worktree setup | 1 |
| 1 | Schema (3 migrations + bucket) | 3 |
| 2 | Helpers (menu/orders/cart/refund) | 4 |
| 3 | Tenant menu management UI | 4 |
| 4 | Occupant menu + cart UI | 4 |
| 5 | Order placement + Paystack flow | 3 |
| 6 | Kitchen queue UI (realtime) | 3 |
| 7 | Order tracker (occupant realtime) | 2 |
| 8 | Notifications (SMS + push) | 1 |
| 9 | Settings + bottom-nav wire | 2 |
| 10 | Cron for abandoned orders | 1 |
| 11 | Docs + UAT | 1 |
| 12 | Build smoke + PR | 2 |

Total: ~31 tasks. Roadmap estimate 7-10 days. **Recommend splitting into multiple PRs** when implementing — e.g. PR-A (schema + tenant menu CRUD), PR-B (occupant order placement), PR-C (kitchen realtime + tracker), PR-D (refunds + cron + reporting).

---

## Self-review notes

- **No room-charge** is a deliberate trade-off. Re-introducing it would require a separate `paid_amount` trigger that distinguishes booking_payments source. Defer to a follow-up if business demand arises.
- **`menu-photos` is public** for portal performance (no signed URL roundtrip). Tenant_id path scoping prevents cross-tenant guess attacks, and admin auth gates uploads.
- **Order ref short** for kitchen ergonomics ("F-A4B7"). Long enough that collisions stay rare; unique index per tenant catches the rest.
- **Cron sweep** for abandoned orders prevents Paystack ghost transactions cluttering the queue. Runs every 5 min, marks `cancelled` if `placed` and `placed_at < now() - interval '30 min'` and `paid_at is null` and `payment_method = 'online'`.
