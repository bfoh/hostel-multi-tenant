# Food Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Recommend splitting into 4 PRs:** PR-A (schema + tenant menu CRUD, Phases 1–3), PR-B (occupant menu/cart/order placement, Phases 4–5), PR-C (kitchen queue + occupant tracker realtime, Phases 6–7), PR-D (notifications + cron + reporting + UAT, Phases 8–12). Each PR is independently mergeable + testable.

**Goal:** Tenant publishes a daily menu; occupants place multi-item orders with online (Paystack) or cash-on-pickup payment; kitchen sees orders in realtime and advances them through `placed → preparing → ready → picked_up`; SMS to occupant when ready.

**Architecture:** New `menu_categories`/`menu_items`/`food_orders`/`food_order_items`/`food_carts` tables. Realtime publication on `food_orders`. Public `menu-photos` bucket. Service-role writes through routes; RLS scopes reads. Paystack reused via existing webhook with `metadata.kind = 'food_order'` discriminator.

**Tech Stack:** Next.js 16 App Router · React Server Components · Supabase Postgres + Realtime + Storage · Paystack · Tailwind · TypeScript · lucide-react

**Spec:** `docs/superpowers/specs/2026-05-06-food-ordering-design.md`

**Testing approach:** No automated test framework. Each task uses `cd apps/web && npm run type-check` plus an explicit manual smoke test. Final task appends UAT phase to `TESTING.md`.

**Conventions worth knowing:**
- Money in **pesewas**. Convert at display.
- `createAdminClient()` for service-role. `createClient()` browser-side from `@/lib/supabase/client`.
- `requireTenantRole(tenantId, allowed)` returns `Context | NextResponse` (not `{ ok }`).
- No `'maintenance'` role. Roles: `owner | manager | receptionist | housekeeper | accountant | security | occupant`. Kitchen recipients = `['owner','manager','housekeeper','receptionist']`.
- Realtime channel pattern: `sb.channel('name').on('postgres_changes', { ... }).subscribe()`.
- `getOccupantSession()` returns `{ userId, occupantId, tenantId, tenantName, tenantColor, firstName, lastName }`.
- Multipart in routes via `request.formData()`.
- Existing Paystack: `lib/paystack.ts` exports `initTransaction` etc.; webhook at `/api/payments/paystack/webhook`.
- SMS: extend `lib/notifications/defaults.ts` event types + add helper functions to `lib/sms.ts` (matches SP 3 pattern).
- Push: `sendPushToUsers(userIds, payload)` from `lib/push.ts` (added in SP 3).

---

## File Structure

**New migrations (3):**

| Path | Responsibility |
|---|---|
| `supabase/migrations/20240001000059_food_menu.sql` | `menu_categories`, `menu_items` + RLS |
| `supabase/migrations/20240001000060_food_orders.sql` | `food_orders`, `food_order_items`, `food_carts`, enums, realtime, tenant settings |
| `supabase/migrations/20240001000061_menu_photos_storage.sql` | Public bucket + path policy |

**New helpers (4):**

| Path | Responsibility |
|---|---|
| `apps/web/lib/food/menu.ts` | `getTodaysMenu`, `getMenuItem` |
| `apps/web/lib/food/cart.ts` | `getCart`, `setCart`, `clearCart` |
| `apps/web/lib/food/orders.ts` | `placeOrder`, `advanceStatus`, `cancelOrder`, `generateOrderRef` |
| `apps/web/lib/food/refund.ts` | Paystack refund wrapper |

**New routes (~12):**

| Path | Purpose |
|---|---|
| `app/api/menu/categories/route.ts` | GET list / POST create (owner/manager) |
| `app/api/menu/categories/[id]/route.ts` | PATCH / DELETE |
| `app/api/menu/items/route.ts` | GET list / POST create |
| `app/api/menu/items/[id]/route.ts` | PATCH / DELETE |
| `app/api/menu/items/[id]/photo/route.ts` | POST multipart upload |
| `app/api/occupant/food/menu/route.ts` | GET today's menu |
| `app/api/occupant/food/cart/route.ts` | GET / POST cart |
| `app/api/occupant/food-orders/route.ts` | POST place order |
| `app/api/occupant/food-orders/[id]/route.ts` | GET / DELETE |
| `app/api/food-orders/[id]/status/route.ts` | PATCH advance status |
| `app/api/cron/food-orders-sweep/route.ts` | Cancel abandoned `placed` online orders > 30 min |

**Modified:**

| Path | Change |
|---|---|
| `app/api/payments/paystack/webhook/route.ts` | Branch on `metadata.kind === 'food_order'` to update `food_orders` instead of `booking_payments` |
| `lib/notifications/defaults.ts` | Add `food_order_ready` + `food_order_cancelled` event types + templates |
| `lib/sms.ts` | Add `sendFoodOrderReady` + `sendFoodOrderCancelled` |
| `apps/web/components/occupant-portal/bottom-nav.tsx` | Add "Food" tab gated on `food_orders_enabled` |
| `apps/web/components/layout/app-sidebar.tsx` | Add Food submenu (Menu / Orders) for owner/manager |
| `apps/web/app/(occupant-portal)/occupant-portal/page.tsx` | Add Food quick-link |

**New occupant pages:**

- `app/(occupant-portal)/occupant-portal/food/page.tsx`
- `app/(occupant-portal)/occupant-portal/food/cart/page.tsx`
- `app/(occupant-portal)/occupant-portal/food/orders/[id]/page.tsx`

**New tenant pages:**

- `app/(tenant)/food/menu/page.tsx`
- `app/(tenant)/food/orders/page.tsx`
- `app/(tenant)/settings/food/page.tsx`

**New components:**

- `components/occupant-portal/food/menu-item-card.tsx`
- `components/occupant-portal/food/cart-drawer.tsx`
- `components/occupant-portal/food/payment-method-picker.tsx`
- `components/occupant-portal/food/order-tracker.tsx`
- `components/food/menu-editor.tsx`
- `components/food/photo-upload.tsx`
- `components/food/order-queue.tsx`
- `components/food/order-card.tsx`

---

## Phase 0 — Worktree setup

### Task 0: Enter worktree

- [ ] **Step 1:** `EnterWorktree` with `name: "feat-food-ordering"` (or `git worktree add .claude/worktrees/feat-food-ordering -b feat/food-ordering` then `cd`).
- [ ] **Step 2:** `npm install --no-audit --no-fund`
- [ ] **Step 3:** `cd apps/web && npm run type-check` — expect 0 errors.

---

## Phase 1 — Schema & storage

### Task 1: Migration 059 — Menu catalog

**Create:** `supabase/migrations/20240001000059_food_menu.sql`

- [ ] **Step 1:** Write migration:

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 059 — Food menu catalog
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists menu_categories (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  sort_order  smallint not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists idx_menu_cat_tenant on menu_categories (tenant_id, sort_order);

create table if not exists menu_items (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  category_id     uuid references menu_categories(id) on delete set null,
  name            text not null,
  description     text check (char_length(coalesce(description, '')) <= 500),
  price_pesewas   integer not null check (price_pesewas > 0),
  photo_url       text,
  is_available    boolean not null default true,
  is_sold_out     boolean not null default false,
  publish_date    date,
  sort_order      smallint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_menu_items_today
  on menu_items (tenant_id, publish_date, is_available, sort_order);

alter table menu_categories enable row level security;
alter table menu_items      enable row level security;

drop policy if exists "tenant members read categories" on menu_categories;
create policy "tenant members read categories"
  on menu_categories for select to authenticated
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid() and is_active));

drop policy if exists "occupants read available items" on menu_items;
create policy "occupants read available items"
  on menu_items for select to authenticated
  using (
    is_available
    and (publish_date is null or publish_date = current_date)
    and tenant_id in (select tenant_id from occupants where user_id = auth.uid())
  );

drop policy if exists "tenant members read all items" on menu_items;
create policy "tenant members read all items"
  on menu_items for select to authenticated
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid() and is_active));
```

- [ ] **Step 2:** `supabase db push 2>&1 | tail -10`. Skip if no staging — commit SQL only.
- [ ] **Step 3:** Commit: `feat(food): migration 059 — menu catalog schema`

---

### Task 2: Migration 060 — Orders + cart + tenant settings

**Create:** `supabase/migrations/20240001000060_food_orders.sql`

- [ ] **Step 1:** Write:

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 060 — Food orders, items, carts + tenant settings
-- ═══════════════════════════════════════════════════════════════════════════

do $$ begin
  create type food_order_status as enum ('placed','preparing','ready','picked_up','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type food_payment_method as enum ('online','cash_on_pickup');
exception when duplicate_object then null; end $$;

create table if not exists food_orders (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  occupant_id         uuid not null references occupants(id),
  booking_id          uuid references bookings(id),
  order_ref           text not null,
  status              food_order_status not null default 'placed',
  total_pesewas       integer not null check (total_pesewas > 0),
  payment_method      food_payment_method not null,
  paystack_reference  text,
  paid_at             timestamptz,
  placed_at           timestamptz not null default now(),
  preparing_at        timestamptz,
  ready_at            timestamptz,
  picked_up_at        timestamptz,
  cancelled_at        timestamptz,
  cancelled_reason    text,
  notes               text check (char_length(coalesce(notes, '')) <= 280)
);
create unique index if not exists food_orders_ref on food_orders (tenant_id, order_ref);
create index if not exists food_orders_queue on food_orders (tenant_id, status, placed_at);
create index if not exists food_orders_occupant on food_orders (tenant_id, occupant_id, placed_at desc);

create table if not exists food_order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references food_orders(id) on delete cascade,
  menu_item_id        uuid not null references menu_items(id),
  name_snapshot       text not null,
  quantity            smallint not null check (quantity between 1 and 10),
  unit_price_pesewas  integer not null check (unit_price_pesewas > 0),
  subtotal_pesewas    integer not null check (subtotal_pesewas > 0)
);
create index if not exists food_order_items_order on food_order_items (order_id);

create table if not exists food_carts (
  occupant_id  uuid primary key references occupants(id) on delete cascade,
  tenant_id    uuid not null references tenants(id) on delete cascade,
  items        jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now()
);

alter table food_orders      enable row level security;
alter table food_order_items enable row level security;
alter table food_carts       enable row level security;

drop policy if exists "occupant reads own food orders" on food_orders;
create policy "occupant reads own food orders"
  on food_orders for select to authenticated
  using (occupant_id in (select id from occupants where user_id = auth.uid()));

drop policy if exists "staff reads tenant food orders" on food_orders;
create policy "staff reads tenant food orders"
  on food_orders for select to authenticated
  using (tenant_id in (select tenant_id from tenant_members where user_id = auth.uid() and is_active));

drop policy if exists "items follow order visibility" on food_order_items;
create policy "items follow order visibility"
  on food_order_items for select to authenticated
  using (
    order_id in (
      select id from food_orders fo
       where fo.occupant_id in (select id from occupants where user_id = auth.uid())
          or fo.tenant_id   in (select tenant_id from tenant_members where user_id = auth.uid() and is_active)
    )
  );

drop policy if exists "occupant reads own cart" on food_carts;
create policy "occupant reads own cart"
  on food_carts for select to authenticated
  using (occupant_id in (select id from occupants where user_id = auth.uid()));

-- Tenant settings
alter table tenants
  add column if not exists food_orders_enabled  boolean not null default false,
  add column if not exists food_cutoff_time     time,
  add column if not exists food_ready_sms       boolean not null default true;

-- Realtime publication for kitchen + tracker
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname='supabase_realtime' and schemaname='public' and tablename='food_orders'
  ) then
    alter publication supabase_realtime add table food_orders;
  end if;
end $$;
```

- [ ] **Step 2:** Apply if possible. Commit either way.
- [ ] **Step 3:** Commit: `feat(food): migration 060 — orders, items, cart + tenant settings`

---

### Task 3: Migration 061 — Menu photos bucket

**Create:** `supabase/migrations/20240001000061_menu_photos_storage.sql`

- [ ] **Step 1:** Write:

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 061 — Menu photos bucket (public, image-only)
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-photos',
  'menu-photos',
  true,
  2 * 1024 * 1024,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public             = true,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
```

- [ ] **Step 2:** Apply / commit: `feat(food): migration 061 — menu-photos bucket`

---

## Phase 2 — Helpers

### Task 4: `lib/food/menu.ts`

**Create:** `apps/web/lib/food/menu.ts`

- [ ] **Step 1:**

```ts
import { createAdminClient } from '@/lib/supabase/admin'

export async function getTodaysMenu(tenantId: string) {
  const admin = createAdminClient() as any
  const { data: cats } = await admin
    .from('menu_categories')
    .select('id, name, sort_order')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  const today = new Date().toISOString().slice(0, 10)
  const { data: items } = await admin
    .from('menu_items')
    .select('id, category_id, name, description, price_pesewas, photo_url, is_sold_out, sort_order')
    .eq('tenant_id', tenantId)
    .eq('is_available', true)
    .or(`publish_date.is.null,publish_date.eq.${today}`)
    .order('sort_order', { ascending: true })
    .limit(500)

  return { categories: cats ?? [], items: items ?? [] }
}

export async function getMenuItem(id: string, tenantId: string) {
  const admin = createAdminClient() as any
  const { data } = await admin
    .from('menu_items')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  return data
}
```

- [ ] **Step 2:** type-check. Commit: `feat(food): menu data helpers`

---

### Task 5: `lib/food/cart.ts`

**Create:** `apps/web/lib/food/cart.ts`

- [ ] **Step 1:**

```ts
import { createAdminClient } from '@/lib/supabase/admin'

export interface CartLine { menu_item_id: string; quantity: number }

export async function getCart(occupantId: string, tenantId: string): Promise<CartLine[]> {
  const admin = createAdminClient() as any
  const { data } = await admin
    .from('food_carts')
    .select('items')
    .eq('occupant_id', occupantId)
    .maybeSingle()
  if (!data) return []
  return (data.items ?? []) as CartLine[]
}

export async function setCart(occupantId: string, tenantId: string, lines: CartLine[]) {
  // Validate lines
  const sane = lines
    .filter(l => l.menu_item_id && Number.isFinite(l.quantity))
    .map(l => ({
      menu_item_id: String(l.menu_item_id),
      quantity:     Math.max(1, Math.min(10, Math.floor(l.quantity))),
    }))

  const admin = createAdminClient() as any
  const { error } = await admin
    .from('food_carts')
    .upsert({
      occupant_id: occupantId,
      tenant_id:   tenantId,
      items:       sane,
      updated_at:  new Date().toISOString(),
    })
  if (error) return { error: error.message }
  return { ok: true as const, items: sane }
}

export async function clearCart(occupantId: string) {
  const admin = createAdminClient() as any
  await admin.from('food_carts').delete().eq('occupant_id', occupantId)
}
```

- [ ] **Step 2:** type-check. Commit: `feat(food): cart helpers`

---

### Task 6: `lib/food/orders.ts`

**Create:** `apps/web/lib/food/orders.ts`

- [ ] **Step 1:**

```ts
import { createAdminClient } from '@/lib/supabase/admin'
import { getCart, clearCart, type CartLine } from './cart'

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // no 0/O/1/I

export function generateOrderRef(): string {
  let s = ''
  for (let i = 0; i < 4; i++) s += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)]
  return `F-${s}`
}

interface PlaceArgs {
  tenantId:       string
  occupantId:     string
  bookingId:      string | null
  paymentMethod:  'online' | 'cash_on_pickup'
  notes:          string | null
}

export async function placeOrder(args: PlaceArgs) {
  const admin = createAdminClient() as any
  const cart  = await getCart(args.occupantId, args.tenantId)
  if (cart.length === 0) return { error: 'Cart is empty' }

  // Validate items still available + snapshot prices
  const ids = cart.map(c => c.menu_item_id)
  const { data: items } = await admin
    .from('menu_items')
    .select('id, name, price_pesewas, is_available, is_sold_out, publish_date, tenant_id')
    .in('id', ids)
    .eq('tenant_id', args.tenantId)
  const today = new Date().toISOString().slice(0, 10)
  const byId  = new Map<string, any>((items ?? []).map((i: any) => [i.id, i]))

  const failed: string[] = []
  for (const line of cart) {
    const it = byId.get(line.menu_item_id)
    if (!it || !it.is_available || it.is_sold_out) {
      failed.push(line.menu_item_id); continue
    }
    if (it.publish_date && it.publish_date !== today) {
      failed.push(line.menu_item_id)
    }
  }
  if (failed.length > 0) return { error: 'Some items unavailable', failed }

  // Build line rows + total
  let total = 0
  const rows = cart.map((line: CartLine) => {
    const it       = byId.get(line.menu_item_id)
    const subtotal = it.price_pesewas * line.quantity
    total += subtotal
    return {
      menu_item_id:       it.id,
      name_snapshot:      it.name,
      quantity:           line.quantity,
      unit_price_pesewas: it.price_pesewas,
      subtotal_pesewas:   subtotal,
    }
  })
  if (total <= 0) return { error: 'Invalid total' }

  // Insert order with retry on order_ref collision
  let order: any = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const ref = generateOrderRef()
    const { data, error } = await admin
      .from('food_orders')
      .insert({
        tenant_id:      args.tenantId,
        occupant_id:    args.occupantId,
        booking_id:     args.bookingId,
        order_ref:      ref,
        status:         'placed',
        total_pesewas:  total,
        payment_method: args.paymentMethod,
        notes:          args.notes,
      })
      .select('id, order_ref, total_pesewas, payment_method')
      .single()
    if (!error) { order = data; break }
    if (error.code !== '23505') return { error: error.message }  // not a unique violation
  }
  if (!order) return { error: 'Could not generate unique ref' }

  const linkedRows = rows.map(r => ({ ...r, order_id: order.id }))
  const { error: itemErr } = await admin.from('food_order_items').insert(linkedRows)
  if (itemErr) {
    await admin.from('food_orders').delete().eq('id', order.id)
    return { error: itemErr.message }
  }

  await clearCart(args.occupantId)
  return { ok: true as const, order }
}

const TRANSITIONS: Record<string, string[]> = {
  placed:     ['preparing', 'cancelled'],
  preparing:  ['ready', 'cancelled'],
  ready:      ['picked_up', 'cancelled'],
  picked_up:  [],
  cancelled:  [],
}

export async function advanceStatus(orderId: string, tenantId: string, next: string, reason?: string) {
  const admin = createAdminClient() as any
  const { data: order } = await admin
    .from('food_orders')
    .select('id, status, occupant_id, payment_method, paid_at, total_pesewas')
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!order) return { error: 'Not found' }

  const allowed = TRANSITIONS[order.status] ?? []
  if (!allowed.includes(next)) return { error: `Cannot transition ${order.status} → ${next}` }

  const stamp = new Date().toISOString()
  const update: any = { status: next }
  if (next === 'preparing') update.preparing_at  = stamp
  if (next === 'ready')     update.ready_at      = stamp
  if (next === 'picked_up') update.picked_up_at  = stamp
  if (next === 'cancelled') {
    update.cancelled_at      = stamp
    update.cancelled_reason  = reason ?? null
  }

  const { error } = await admin.from('food_orders').update(update).eq('id', orderId)
  if (error) return { error: error.message }
  return { ok: true as const, prev: order.status, order }
}
```

- [ ] **Step 2:** type-check. Commit: `feat(food): order placement + state machine helper`

---

### Task 7: `lib/food/refund.ts`

**Create:** `apps/web/lib/food/refund.ts`

- [ ] **Step 1:**

```ts
/**
 * Paystack refund wrapper for food orders.
 * Reuses PAYSTACK_SECRET_KEY env. No-op when not configured.
 */
export async function refundFoodOrder(paystackReference: string, amountPesewas: number) {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) return { ok: false, reason: 'Paystack not configured' }

  const res = await fetch('https://api.paystack.co/refund', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      transaction: paystackReference,
      amount:      amountPesewas,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { ok: false, reason: text.slice(0, 280) }
  }
  return { ok: true as const }
}
```

- [ ] **Step 2:** type-check. Commit: `feat(food): Paystack refund wrapper`

---

## Phase 3 — Tenant menu management

### Task 8: Menu category CRUD routes

**Create:** `apps/web/app/api/menu/categories/route.ts` + `apps/web/app/api/menu/categories/[id]/route.ts`

- [ ] **Step 1:** Implement `GET` (list) + `POST` (create) on collection route. Implement `PATCH` (update) + `DELETE` on `[id]` route. All gated by `requireTenantRole(tenantId, ['owner','manager'])`.

```ts
// route.ts (collection)
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { createAdminClient } from '@/lib/supabase/admin'

const createSchema = z.object({
  name:       z.string().min(1).max(80),
  sort_order: z.number().int().min(0).max(9999).default(0),
})

export async function GET() {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
  const ctx = await requireTenantRole(tenantId, ['owner','manager','housekeeper','receptionist','accountant'])
  if (ctx instanceof NextResponse) return ctx

  const admin = createAdminClient() as any
  const { data } = await admin.from('menu_categories')
    .select('id, name, sort_order, is_active, created_at')
    .eq('tenant_id', tenantId).order('sort_order')
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
  const ctx = await requireTenantRole(tenantId, ['owner','manager'])
  if (ctx instanceof NextResponse) return ctx

  const json = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 422 })

  const admin = createAdminClient() as any
  const { data, error } = await admin.from('menu_categories')
    .insert({ tenant_id: tenantId, ...parsed.data })
    .select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
```

```ts
// [id]/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { createAdminClient } from '@/lib/supabase/admin'

const updateSchema = z.object({
  name:       z.string().min(1).max(80).optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
  is_active:  z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
  const ctx = await requireTenantRole(tenantId, ['owner','manager'])
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  const json = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 422 })

  const admin = createAdminClient() as any
  const { error } = await admin.from('menu_categories')
    .update(parsed.data).eq('id', id).eq('tenant_id', tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
  const ctx = await requireTenantRole(tenantId, ['owner','manager'])
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  const admin = createAdminClient() as any
  const { error } = await admin.from('menu_categories').delete().eq('id', id).eq('tenant_id', tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2:** type-check. Commit: `feat(food): menu categories CRUD routes`

---

### Task 9: Menu item CRUD routes + photo upload

**Create:** `apps/web/app/api/menu/items/route.ts`, `apps/web/app/api/menu/items/[id]/route.ts`, `apps/web/app/api/menu/items/[id]/photo/route.ts`

- [ ] **Step 1:** Item CRUD mirrors category CRUD; schema:

```ts
const createSchema = z.object({
  category_id:   z.string().uuid().nullable().optional(),
  name:          z.string().min(1).max(120),
  description:   z.string().max(500).nullable().optional(),
  price_pesewas: z.number().int().min(1),
  is_available:  z.boolean().default(true),
  is_sold_out:   z.boolean().default(false),
  publish_date:  z.string().nullable().optional(),
  sort_order:    z.number().int().min(0).max(9999).default(0),
})
```

PATCH uses `.partial()` over the same shape. Kitchen staff (owner/manager/housekeeper) allowed to PATCH only `is_available` + `is_sold_out` — gate via role check + restricted schema for that role.

For brevity here: implement both with `requireTenantRole(['owner','manager'])` for create/delete, and `requireTenantRole(['owner','manager','housekeeper'])` for the kitchen-style toggle (`is_sold_out`/`is_available`). Two PATCH variants split by allowed body shape per role.

- [ ] **Step 2:** Photo route — multipart, 2 MB cap, image-only:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED = new Set(['image/jpeg','image/png','image/webp'])

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
  const ctx = await requireTenantRole(tenantId, ['owner','manager'])
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: 'Max 2 MB' }, { status: 400 })
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: `Bad type ${file.type}` }, { status: 400 })

  const safeName = (file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60)) || 'photo'
  const path     = `${tenantId}/menu/${id}/${Date.now()}_${safeName}`
  const buf      = Buffer.from(await file.arrayBuffer())

  const admin = createAdminClient() as any
  const { error: upErr } = await admin.storage.from('menu-photos').upload(path, buf, {
    contentType: file.type, upsert: false,
  })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: pub } = admin.storage.from('menu-photos').getPublicUrl(path)
  const photo_url = pub?.publicUrl ?? null

  const { error: updErr } = await admin.from('menu_items')
    .update({ photo_url, updated_at: new Date().toISOString() })
    .eq('id', id).eq('tenant_id', tenantId)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ photo_url })
}
```

- [ ] **Step 3:** type-check. Commit: `feat(food): menu items CRUD + photo upload`

---

### Task 10: Tenant menu management page + components

**Create:** `apps/web/app/(tenant)/food/menu/page.tsx`, `components/food/menu-editor.tsx`, `components/food/photo-upload.tsx`

- [ ] **Step 1:** Server page fetches categories + items, renders `<MenuEditor>`. `<MenuEditor>` is a client component with category list, item table per category, inline edit/create modal, photo upload.

(Keep UI minimal — the design lives in spec; engineers should match `/(tenant)` aesthetic. Reuse modal/dialog patterns from existing tenant pages.)

- [ ] **Step 2:** type-check. Commit: `feat(food): tenant menu management page`

---

### Task 11: Sidebar entry + settings page

**Modify:** `apps/web/components/layout/app-sidebar.tsx`. Add Food submenu (Menu / Orders) for owner/manager.

**Create:** `apps/web/app/(tenant)/settings/food/page.tsx`. Form posts to existing `/api/settings/branding` (extend that schema) or new `/api/settings/food`. Three fields: `food_orders_enabled`, `food_cutoff_time`, `food_ready_sms`.

- [ ] **Step 1+2:** Implement + type-check. Commit: `feat(food): sidebar + tenant settings page`

---

## Phase 4 — Occupant menu + cart

### Task 12: Occupant menu API + page

**Create:** `apps/web/app/api/occupant/food/menu/route.ts` (GET today's menu) and `apps/web/app/(occupant-portal)/occupant-portal/food/page.tsx`.

- [ ] **Step 1:** Route uses `getOccupantSession()` + `getTodaysMenu(tenantId)`.
- [ ] **Step 2:** Page is a server component rendering categories + items via `<MenuItemCard>`.
- [ ] **Step 3:** Commit: `feat(food): occupant menu page`

---

### Task 13: `<MenuItemCard>` + `<CartDrawer>`

**Create:** `apps/web/components/occupant-portal/food/menu-item-card.tsx`, `cart-drawer.tsx`.

- [ ] **Step 1:** Card has photo, name, description, price, +/– quantity stepper, "Add to cart" CTA. Cart state held in a React context populated from server-fetched cart on mount.
- [ ] **Step 2:** Drawer is a bottom sheet showing line items + total + "Review cart" link to `/occupant-portal/food/cart`.
- [ ] **Step 3:** Commit: `feat(food): menu item card + cart drawer`

---

### Task 14: Cart route + cart page

**Create:** `apps/web/app/api/occupant/food/cart/route.ts` and `apps/web/app/(occupant-portal)/occupant-portal/food/cart/page.tsx`.

- [ ] **Step 1:** GET returns `getCart()` results joined with menu item names + prices. POST replaces cart via `setCart()`.
- [ ] **Step 2:** Page lists cart lines with quantity steppers, removes via setting quantity to 0, total, place-order button → `<PaymentMethodPicker>`.
- [ ] **Step 3:** Commit: `feat(food): cart api + cart review page`

---

## Phase 5 — Order placement + Paystack

### Task 15: `POST /api/occupant/food-orders`

**Create:** `apps/web/app/api/occupant/food-orders/route.ts`

- [ ] **Step 1:**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { placeOrder } from '@/lib/food/orders'
import { sendPushToUsers } from '@/lib/push'
import { initTransaction } from '@/lib/paystack'   // verify exact export name in lib/paystack.ts

const schema = z.object({
  payment_method: z.enum(['online', 'cash_on_pickup']),
  notes:          z.string().max(280).nullable().optional(),
})

export async function POST(req: NextRequest) {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const json   = await req.json().catch(() => null)
  const parsed = schema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 422 })

  // Pull active booking_id (if any) for ledger linkage
  const admin = createAdminClient() as any
  const { data: booking } = await admin
    .from('bookings')
    .select('id')
    .eq('tenant_id', session.tenantId)
    .eq('occupant_id', session.occupantId)
    .in('status', ['checked_in','confirmed'])
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle()

  const result = await placeOrder({
    tenantId:      session.tenantId,
    occupantId:    session.occupantId,
    bookingId:     booking?.id ?? null,
    paymentMethod: parsed.data.payment_method,
    notes:         parsed.data.notes ?? null,
  })
  if ('error' in result) {
    return NextResponse.json(result, { status: result.failed ? 409 : 400 })
  }
  const order = result.order

  // Cash path: notify kitchen now
  if (parsed.data.payment_method === 'cash_on_pickup') {
    await pingKitchen(session.tenantId, order.id)
    return NextResponse.json({ id: order.id, order_ref: order.order_ref }, { status: 201 })
  }

  // Online path: init Paystack
  const init = await initTransaction({
    email:    session.userId + '@occupant.local',  // or fetch occupant email
    amount:   order.total_pesewas,
    reference: order.id,
    metadata: { kind: 'food_order', order_id: order.id, tenant_id: session.tenantId },
    callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/occupant-portal/food/orders/${order.id}`,
  })
  if (!init?.authorization_url) {
    return NextResponse.json({ error: 'Paystack init failed' }, { status: 500 })
  }

  return NextResponse.json({
    id:                order.id,
    order_ref:         order.order_ref,
    authorization_url: init.authorization_url,
  }, { status: 201 })
}

async function pingKitchen(tenantId: string, orderId: string) {
  const admin = createAdminClient() as any
  const { data: members } = await admin
    .from('tenant_members')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .in('role', ['owner','manager','housekeeper','receptionist'])
  const userIds = (members ?? []).map((m: any) => m.user_id)
  if (userIds.length === 0) return
  await sendPushToUsers(userIds, {
    title: 'New food order',
    body:  `New order placed`,
    url:   `/food/orders`,
  }).catch(err => console.error('[food order push]', err))
}
```

- [ ] **Step 2:** type-check. **Verify `initTransaction` signature against `lib/paystack.ts`** — adapt if needed.
- [ ] **Step 3:** Commit: `feat(food): place-order route + kitchen push`

---

### Task 16: Order detail GET + cancel DELETE

**Create:** `apps/web/app/api/occupant/food-orders/[id]/route.ts`

- [ ] **Step 1:**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { advanceStatus } from '@/lib/food/orders'
import { refundFoodOrder } from '@/lib/food/refund'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const admin = createAdminClient() as any
  const { data: order } = await admin
    .from('food_orders')
    .select('*, food_order_items(*)')
    .eq('id', id)
    .eq('tenant_id', session.tenantId)
    .eq('occupant_id', session.occupantId)
    .maybeSingle()
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(order)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const admin = createAdminClient() as any

  const { data: order } = await admin
    .from('food_orders')
    .select('id, status, payment_method, paid_at, paystack_reference, total_pesewas')
    .eq('id', id)
    .eq('tenant_id', session.tenantId)
    .eq('occupant_id', session.occupantId)
    .maybeSingle()
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.status !== 'placed') return NextResponse.json({ error: 'Cannot cancel after preparing' }, { status: 409 })

  const result = await advanceStatus(id, session.tenantId, 'cancelled', 'cancelled by occupant')
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

  if (order.payment_method === 'online' && order.paid_at && order.paystack_reference) {
    refundFoodOrder(order.paystack_reference, order.total_pesewas)
      .catch(err => console.error('[food refund]', err))
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2:** type-check. Commit: `feat(food): occupant order detail + cancel`

---

### Task 17: Extend Paystack webhook

**Modify:** `apps/web/app/api/payments/paystack/webhook/route.ts`

- [ ] **Step 1:** Inside the existing webhook handler, read `event.data.metadata`. Branch on `metadata.kind`:

```ts
if (metadata?.kind === 'food_order' && event.event === 'charge.success') {
  await admin.from('food_orders').update({
    paid_at:            new Date().toISOString(),
    paystack_reference: event.data.reference,
  }).eq('id', metadata.order_id)
  // Notify kitchen
  // (... pingKitchen logic; may extract to lib/food/orders.ts)
  return NextResponse.json({ ok: true })
}
```

Place branch BEFORE the existing `booking_payments` update so food orders never touch rent ledgers.

- [ ] **Step 2:** type-check. Commit: `feat(food): Paystack webhook handles food_order metadata`

---

## Phase 6 — Kitchen queue (staff realtime)

### Task 18: `PATCH /api/food-orders/[id]/status`

**Create:** `apps/web/app/api/food-orders/[id]/status/route.ts`

- [ ] **Step 1:**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { createAdminClient } from '@/lib/supabase/admin'
import { advanceStatus } from '@/lib/food/orders'
import { refundFoodOrder } from '@/lib/food/refund'
import { sendPushToUsers } from '@/lib/push'
import { sendFoodOrderReady, sendFoodOrderCancelled } from '@/lib/sms'

const schema = z.object({
  status: z.enum(['preparing','ready','picked_up','cancelled']),
  reason: z.string().max(280).nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
  const ctx = await requireTenantRole(tenantId, ['owner','manager','housekeeper','receptionist'])
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  const json   = await req.json().catch(() => null)
  const parsed = schema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 422 })

  const result = await advanceStatus(id, tenantId, parsed.data.status, parsed.data.reason ?? undefined)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

  const order = result.order
  const admin = createAdminClient() as any
  const { data: occ } = await admin
    .from('occupants')
    .select('user_id, phone, first_name')
    .eq('id', order.occupant_id)
    .maybeSingle()
  const { data: tenantRow } = await admin.from('tenants')
    .select('name, food_ready_sms').eq('id', tenantId).maybeSingle()
  const hostelName = tenantRow?.name ?? 'Hostel'

  if (parsed.data.status === 'ready') {
    if (occ?.user_id) {
      sendPushToUsers([occ.user_id], {
        title: 'Order ready for pickup',
        body:  `Order ${order.order_ref ?? id.slice(0,8)} is ready`,
        url:   `/occupant-portal/food/orders/${id}`,
      }).catch(err => console.error('[food ready push]', err))
    }
    if (tenantRow?.food_ready_sms && occ?.phone && occ?.first_name && order.order_ref) {
      sendFoodOrderReady({
        phone: occ.phone, firstName: occ.first_name,
        orderRef: order.order_ref, hostelName, tenantId,
      }).catch(err => console.error('[food ready sms]', err))
    }
  }

  if (parsed.data.status === 'cancelled') {
    if (occ?.user_id) {
      sendPushToUsers([occ.user_id], {
        title: 'Order cancelled',
        body:  parsed.data.reason ?? 'Cancelled by hostel',
        url:   `/occupant-portal/food/orders/${id}`,
      }).catch(err => console.error('[food cancelled push]', err))
    }
    if (occ?.phone && occ?.first_name && order.order_ref) {
      sendFoodOrderCancelled({
        phone: occ.phone, firstName: occ.first_name,
        orderRef: order.order_ref, hostelName,
        reason: parsed.data.reason ?? 'cancelled', tenantId,
      }).catch(err => console.error('[food cancelled sms]', err))
    }
    // Refund if online + paid
    if (order.payment_method === 'online' && order.paid_at && order.paystack_reference) {
      refundFoodOrder(order.paystack_reference, order.total_pesewas)
        .catch(err => console.error('[food refund]', err))
    }
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2:** type-check. Commit: `feat(food): kitchen status route + notifications`

---

### Task 19: Kitchen queue page + components

**Create:** `apps/web/app/(tenant)/food/orders/page.tsx`, `components/food/order-queue.tsx`, `components/food/order-card.tsx`.

- [ ] **Step 1:** Server page fetches initial queue:

```ts
const { data } = await admin
  .from('food_orders')
  .select('*, food_order_items(*), occupant:occupants(first_name, last_name, phone)')
  .eq('tenant_id', tenantId)
  .in('status', ['placed','preparing','ready'])
  .order('placed_at', { ascending: true })
```

Renders `<OrderQueue initialOrders={data} tenantId={tenantId} />`.

- [ ] **Step 2:** `<OrderQueue>` — client component, subscribes to `food-orders:tenant:<tenantId>` channel, three columns by status (Placed / Preparing / Ready), each card from `<OrderCard>`.
- [ ] **Step 3:** `<OrderCard>` — order_ref header, item list, action buttons matching state machine (Start preparing / Mark ready / Mark picked up / Cancel).
- [ ] **Step 4:** type-check. Commit: `feat(food): kitchen queue realtime + order cards`

---

## Phase 7 — Occupant order tracker

### Task 20: Order tracker page + component

**Create:** `apps/web/app/(occupant-portal)/occupant-portal/food/orders/[id]/page.tsx`, `components/occupant-portal/food/order-tracker.tsx`.

- [ ] **Step 1:** Server page fetches order + items, renders `<OrderTracker initialOrder={...} />`.
- [ ] **Step 2:** Client component subscribes to `food-orders:<order_id>`, shows status pill stepper (placed → preparing → ready → picked_up). Cancel button visible only at `placed`.
- [ ] **Step 3:** type-check. Commit: `feat(food): occupant order tracker realtime`

---

## Phase 8 — Notifications

### Task 21: SMS templates + helpers

**Modify:** `apps/web/lib/notifications/defaults.ts`, `apps/web/lib/sms.ts`

- [ ] **Step 1:** Add events:

```ts
| 'food_order_ready'
| 'food_order_cancelled'
```

Templates:

```ts
{
  event_type: 'food_order_ready',
  channel:    'sms',
  body: 'Hi {{first_name}}, your food order {{order_ref}} at {{hostel_name}} is ready for pickup.',
},
{
  event_type: 'food_order_cancelled',
  channel:    'sms',
  body: 'Hi {{first_name}}, your food order {{order_ref}} at {{hostel_name}} was cancelled. Reason: {{reason}}.',
},
```

- [ ] **Step 2:** SMS helpers `sendFoodOrderReady` + `sendFoodOrderCancelled` matching existing pattern (see SP 3 for shape).
- [ ] **Step 3:** type-check. Commit: `feat(food): SMS templates + helpers`

---

## Phase 9 — Settings + nav wire

### Task 22: Bottom-nav Food tile + home quick-link

**Modify:** `apps/web/components/occupant-portal/bottom-nav.tsx` and `apps/web/app/(occupant-portal)/occupant-portal/page.tsx`.

- [ ] **Step 1:** Bottom-nav: insert Food tab gated on `food_orders_enabled`. Tab needs server-fetched flag — pass through layout that already fetches tenant settings.
- [ ] **Step 2:** Home: add "Order food" quick-link tile (UtensilsCrossed icon).
- [ ] **Step 3:** type-check. Commit: `feat(food): bottom-nav tab + home quick-link`

---

## Phase 10 — Cron sweep

### Task 23: Abandoned-order cancel cron

**Create:** `apps/web/app/api/cron/food-orders-sweep/route.ts`

- [ ] **Step 1:**

```ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  // Vercel cron auth
  const expected = process.env.CRON_SECRET
  if (expected && req.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient() as any
  const cutoff = new Date(Date.now() - 30 * 60_000).toISOString()
  const { data, error } = await admin
    .from('food_orders')
    .update({
      status:           'cancelled',
      cancelled_at:     new Date().toISOString(),
      cancelled_reason: 'Payment not completed within 30 minutes',
    })
    .eq('status', 'placed')
    .eq('payment_method', 'online')
    .is('paid_at', null)
    .lt('placed_at', cutoff)
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ swept: (data ?? []).length })
}
```

Add to `vercel.json` cron schedule (every 5 min) — instruct human to add. Or add server-side schedule via Supabase scheduled function as a follow-up.

- [ ] **Step 2:** type-check. Commit: `feat(food): cron sweep for abandoned orders`

---

## Phase 11 — Documentation

### Task 24: TESTING.md UAT phase

**Modify:** `TESTING.md`

- [ ] **Step 1:** Append:

```bash
cat >> TESTING.md <<'EOF'

---

## Phase — Food Ordering

Pre-requisites:
- `food_orders_enabled = true` for the test tenant.
- At least 3 `menu_items` published for today.
- Test occupant has an active booking.
- Paystack test keys configured (for online payment path).

### Menu management

- [ ] Owner can create a category → appears on tenant menu page.
- [ ] Owner can create an item with photo → photo URL renders on occupant menu.
- [ ] Manager can toggle `is_sold_out` → item shows greyed-out on occupant menu.
- [ ] Item with `publish_date = yesterday` does NOT appear on occupant menu.
- [ ] Item with `publish_date = today` appears.
- [ ] Item with `publish_date = null` (always-on) appears.
- [ ] Item with `is_available = false` does NOT appear on occupant menu.

### Cart

- [ ] Add item → cart badge increments.
- [ ] Quantity stepper enforces 1–10.
- [ ] Cart persists across logout / login.
- [ ] Removing all items empties the cart.

### Order placement — online

- [ ] Submit cart → redirect to Paystack test page.
- [ ] Successful payment → webhook marks `paid_at`. Kitchen queue receives the order in <2s.
- [ ] Abandoned payment (close tab) → after 30 min cron sweep marks order `cancelled`.

### Order placement — cash on pickup

- [ ] Submit cart with cash → kitchen queue receives order immediately. No Paystack redirect.

### Kitchen queue

- [ ] Three columns (Placed / Preparing / Ready) populate from initial fetch.
- [ ] New order appears in Placed column within 1s of placement.
- [ ] "Start preparing" → moves to Preparing column live in all open browsers.
- [ ] "Mark ready" → moves to Ready; resident push fires; SMS fires (if configured).
- [ ] "Mark picked up" → order disappears from queue.
- [ ] "Cancel" with reason → order disappears; resident push + SMS fire; refund attempt for online+paid.

### Tracker

- [ ] Tracker page loads with current status pill.
- [ ] Status changes from kitchen reflect in tracker live.
- [ ] Cancel button visible only at `placed`.
- [ ] Cancel from tracker → order moves to cancelled; refund attempt if online+paid.

### Auth & access

- [ ] Direct GET `/api/occupant/food-orders/<another-occupant's-id>` → 404.
- [ ] Receptionist → 403 on POST `/api/menu/items` (owner/manager only).
- [ ] Housekeeper → 200 on PATCH `/api/menu/items/[id]` toggling `is_sold_out`.
- [ ] Logged-out user → /login redirect on /occupant-portal/food.
- [ ] When `food_orders_enabled = false`: bottom-nav Food tab hidden; direct GET /occupant-portal/food → 404 or redirect.

### Refunds

- [ ] Cancel an online+paid order. Paystack dashboard shows refund request created.
- [ ] Cancel a cash order before pickup → no Paystack call.
- [ ] Cancel an online+unpaid order → no Paystack call (nothing to refund).
EOF
echo "appended"
```

- [ ] **Step 2:** Commit: `docs(testing): food ordering UAT phase`

---

## Phase 12 — Build smoke + PR

### Task 25: Build smoke

- [ ] **Step 1:** `cd apps/web && npm run build` — verify no errors.
- [ ] **Step 2:** Confirm route list includes:
  - `/api/menu/categories`, `/api/menu/categories/[id]`
  - `/api/menu/items`, `/api/menu/items/[id]`, `/api/menu/items/[id]/photo`
  - `/api/occupant/food/menu`, `/api/occupant/food/cart`
  - `/api/occupant/food-orders`, `/api/occupant/food-orders/[id]`
  - `/api/food-orders/[id]/status`
  - `/api/cron/food-orders-sweep`
  - `/(occupant-portal)/occupant-portal/food`, `/cart`, `/orders/[id]`
  - `/(tenant)/food/menu`, `/food/orders`, `/settings/food`

---

### Task 26: Push + PR

- [ ] **Step 1:** `git push -u origin $(git branch --show-current)`
- [ ] **Step 2:** Open PR (4-PR split recommended — see top). For a single mega-PR:

```bash
gh pr create --title "feat: food ordering (sub-project 4 of 4)" --body "$(cat <<'EOF'
## Summary

End-to-end food ordering for the resident portal:

- Tenant publishes daily menu (categories + items, photos, sold_out toggle)
- Occupants browse, add to persistent cart, place multi-item orders
- Pay online (Paystack) or cash-on-pickup
- Kitchen sees realtime queue, advances `placed → preparing → ready → picked_up`
- SMS to occupant when ready (tenant-configurable)
- Cron sweeps abandoned online orders after 30 min

## Migrations

**Three migrations must apply before merge:**

- `20240001000059_food_menu.sql`
- `20240001000060_food_orders.sql`
- `20240001000061_menu_photos_storage.sql`

## What's NOT in this PR

- Room-charge as payment method (avoids `paid_amount` trigger collision with rent)
- Stock counts
- Time-based pricing
- Top-items dashboard
- Service-privileges abstraction (laundry/gym)
- Customisable items / allergen tags

## Spec & plan

- Spec: `docs/superpowers/specs/2026-05-06-food-ordering-design.md`
- Plan: `docs/superpowers/plans/2026-05-06-food-ordering.md`

## Test plan

See `TESTING.md` → **Phase — Food Ordering** for full UAT.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3:** Surface PR URL.

---

## Self-review notes

- **`initTransaction` exact signature** lives in `lib/paystack.ts` — verify before Task 15. Plan's call site may need adapting (e.g. param naming, return shape).
- **Webhook ordering matters.** Food-order branch in webhook MUST run before booking-payment branch so a `metadata.kind = 'food_order'` event never falls through to rent reconciliation.
- **`(any)` casts proliferate** because new tables aren't in regenerated Supabase types until `npm run gen-types` runs against staging. Same pattern as SP 3.
- **No occupant SMS for "preparing"** — kept off intentionally to control cost. Add later if business asks.
- **`food_carts` row uses `occupant_id` as PK** — one cart per occupant globally, not per tenant. Correct because occupant rows are themselves tenant-scoped.
- **Order ref alphabet excludes 0/O/1/I** to reduce kitchen miscommunication.
- **Bottom-nav now 7 tabs** if Food tab added unconditionally. Gate it on `food_orders_enabled` so default deployments stay at 6.
- **No automated tests** — same project policy as SP 1–3.
- **Recommend split into 4 PRs** at execution time — see top of plan. Each PR independently mergeable + UAT-able.
