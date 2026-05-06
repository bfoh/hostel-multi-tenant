# Student Portal — Invoice Viewing & Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/occupant-portal/invoices` list + detail page + PDF download route, all gated by occupant ownership of the underlying booking. Reuses the existing `<InvoicePDF>` React PDF component and the `bookings` schema with no migrations.

**Architecture:** New Next.js server components fetch occupant-scoped invoice data via a new `lib/data/occupant-invoices.ts` helper. The PDF route mirrors `app/api/invoices/[id]/pdf/route.ts` but swaps tenant-staff auth for `getOccupantSession()` and adds a booking-ownership check.

**Tech Stack:** Next.js 16 App Router · React Server Components · Supabase Postgres · `@react-pdf/renderer` · Tailwind · TypeScript · lucide-react

**Spec:** `docs/superpowers/specs/2026-05-05-student-portal-invoices-design.md`

**Testing approach:** Project has no test framework. Each task uses `cd apps/web && npm run type-check` + an explicit manual smoke test. Final task appends a UAT section to `TESTING.md`.

**Conventions worth knowing:**
- Money in **pesewas** (1 GHS = 100 pesewas). Conversion only at display boundary.
- Service-role writes use `createAdminClient()`. Cookie-bound user reads use `await createClient()`.
- Occupant context: `getOccupantSession()` from `lib/auth/occupant-session.ts` returns `{ userId, occupantId, tenantId, tenantName, tenantColor, firstName, lastName }`.
- Bookings already have `invoice_number` (migration 008), tax columns (`vat_amount`, `nhil_amount`, `getfund_amount`), `paid_amount`, `final_amount`.
- `booking_payments.status` enum is `'pending' | 'success' | 'failed' | 'reversed'`. **Note: the existing tenant `/api/invoices/[id]/pdf` route filters by `status === 'paid'` (line 56) which never matches — pre-existing bug. The occupant route will use `'success'`.**

---

## File Structure

**New files (5):**

| Path | Responsibility |
|---|---|
| `apps/web/lib/data/occupant-invoices.ts` | Two helpers: `getOccupantInvoices(occupantId, tenantId)` for list, `getOccupantInvoiceById(id, occupantId, tenantId)` for detail. Both filter by occupant ownership. |
| `apps/web/app/api/occupant/invoices/[id]/pdf/route.ts` | GET handler — verifies occupant ownership via `getOccupantInvoiceById`, renders `<InvoicePDF>`, returns Buffer with `Content-Disposition: attachment`. |
| `apps/web/components/occupant-portal/invoice-card.tsx` | Server component — renders one card with status pill, room, dates, amount, "View →". |
| `apps/web/app/(occupant-portal)/occupant-portal/invoices/page.tsx` | Server component — list of cards, empty state. |
| `apps/web/app/(occupant-portal)/occupant-portal/invoices/[id]/page.tsx` | Server component — detail view with line items, payments, totals, Download PDF button. |

**Modified files (2):**

| Path | Change |
|---|---|
| `apps/web/components/occupant-portal/bottom-nav.tsx` | Add Invoices tab (FileText icon, slide animation) |
| `apps/web/app/(occupant-portal)/occupant-portal/page.tsx` | Add "View invoices" tile to the Quick links section |

**Reused unchanged:**
- `apps/web/components/invoices/invoice-pdf.tsx` — the `<InvoicePDF>` React PDF component.
- `apps/web/lib/data/invoices.ts` — kept untouched; occupant-side gets its own data layer for clean auth boundaries.

---

## Phase 0 — Worktree setup

### Task 0: Create isolated worktree

**Files:** none (git only)

- [ ] **Step 1: Confirm starting state**

Run from project root `/Users/ebenezerbarning/Desktop/hostels`:
```bash
git status --short
git log --oneline -3
```

Expected: HEAD includes `7b6f560 docs(spec): student portal — invoice viewing & download` (the SP 2 spec). Pre-existing in-progress modifications (settings page, broadcast route, etc.) may still be in the working tree — leave them alone.

- [ ] **Step 2: Create worktree via the EnterWorktree tool (preferred)**

If running under Claude Code, use the `EnterWorktree` tool with `name: "feat-occupant-invoices"`. The session switches to the new worktree directory automatically.

If `EnterWorktree` is not available, fall back to:
```bash
git worktree add .claude/worktrees/feat-occupant-invoices -b feat/occupant-invoices
cd .claude/worktrees/feat-occupant-invoices
```

- [ ] **Step 3: Verify worktree state**

```bash
pwd
git branch --show-current
git status --short
```

Expected: in the worktree, on the new branch (`worktree-feat-occupant-invoices` if EnterWorktree was used, or `feat/occupant-invoices` for the fallback), clean tree.

- [ ] **Step 4: Install deps + baseline type-check**

```bash
npm install --no-audit --no-fund
cd apps/web && npm run type-check
```

Expected: install completes; `tsc --noEmit` exits 0.

If `npm install` fails due to the `dyld[...]: Library not loaded: ...icu4c/lib/libicui18n.74.dylib` error, repoint the icu4c symlink:
```bash
ln -sfn ../Cellar/icu4c/74.2 /usr/local/opt/icu4c
```

This was done during sub-project 1 setup; it should still be in place. Re-run if Homebrew has overwritten it.

- [ ] **Step 5: Copy `.env.local` if needed**

The worktree doesn't share gitignored files. If `apps/web/.env.local` exists in the main checkout, copy it:
```bash
cp /Users/ebenezerbarning/Desktop/hostels/apps/web/.env.local apps/web/.env.local 2>/dev/null || true
```

(No-op if there's nothing to copy. The implementation tasks don't actually need `.env.local` since type-check + git ops are the only things this plan runs locally — Supabase access is the user's responsibility post-PR.)

---

## Phase 1 — Data layer

### Task 1: Occupant-scoped invoice data helpers

**Files:**
- Create: `apps/web/lib/data/occupant-invoices.ts`

- [ ] **Step 1: Write the file**

Create `apps/web/lib/data/occupant-invoices.ts` with this exact content:

```ts
/**
 * Occupant-scoped invoice queries.
 *
 * "Invoice" in this codebase = a booking row joined with occupant + room +
 * payments. The shape mirrors lib/data/invoices.ts (tenant-side) but every
 * query filters by occupant_id so a student can only see their own.
 *
 * Auth happens at the route layer via getOccupantSession(); these helpers
 * trust their inputs and run with the service role.
 */

import { createAdminClient } from '@/lib/supabase/admin'

const INVOICE_QUERY = `
  id, booking_ref, status, payment_status,
  check_in_date, check_out_date, created_at,
  rate_per_unit, rate_unit, total_amount,
  discount_amount, discount_reason,
  tax_amount, vat_amount, nhil_amount, getfund_amount,
  final_amount, paid_amount,
  semester, academic_year, source, notes,
  occupant:occupants(
    id, first_name, last_name, other_names, phone, email,
    student_id, institution, programme
  ),
  room:rooms(
    id, room_number, block, floor,
    category:room_categories(name, type, base_rate, rate_unit)
  ),
  booking_payments(
    id, amount, method, reference, status, paid_at
  )
`

export async function getOccupantInvoices(occupantId: string, tenantId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('bookings')
    .select(INVOICE_QUERY + ', invoice_number')
    .eq('tenant_id', tenantId)
    .eq('occupant_id', occupantId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[occupant-invoices] list query failed', error)
    return [] as any[]
  }
  return (data ?? []) as any[]
}

export async function getOccupantInvoiceById(
  bookingId: string,
  occupantId: string,
  tenantId: string,
) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('bookings')
    .select(INVOICE_QUERY + ', invoice_number')
    .eq('id', bookingId)
    .eq('tenant_id', tenantId)
    .eq('occupant_id', occupantId)
    .maybeSingle()

  if (error) {
    console.error('[occupant-invoices] detail query failed', error)
    return null
  }
  return data as any
}

export type OccupantInvoice = NonNullable<Awaited<ReturnType<typeof getOccupantInvoiceById>>>
```

> Note on the `+ ', invoice_number'` concatenation: `invoice_number` is on `bookings` itself (added by migration 008) but isn't in the shared `INVOICE_QUERY` constant. Appending it keeps the column in the response without mutating the original constant.

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npm run type-check
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

From the worktree root:
```bash
git add apps/web/lib/data/occupant-invoices.ts
git commit -m "feat(invoices): occupant-scoped invoice data helpers"
```

---

## Phase 2 — PDF route

### Task 2: `GET /api/occupant/invoices/[id]/pdf`

**Files:**
- Create: `apps/web/app/api/occupant/invoices/[id]/pdf/route.ts`

- [ ] **Step 1: Write the route**

Create `apps/web/app/api/occupant/invoices/[id]/pdf/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React, { createElement } from 'react'

import { getOccupantSession } from '@/lib/auth/occupant-session'
import { getOccupantInvoiceById } from '@/lib/data/occupant-invoices'
import { createAdminClient } from '@/lib/supabase/admin'
import { InvoicePDF } from '@/components/invoices/invoice-pdf'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const inv    = await getOccupantInvoiceById(id, session.occupantId, session.tenantId)
  if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  // Tenant header info for the PDF letterhead.
  const admin = createAdminClient()
  const { data: tenant } = await admin
    .from('tenants')
    .select('name, tagline, address_line1, address_city, contact_phone, contact_email, logo_url, tin, vat_reg_number, is_vat_registered')
    .eq('id', session.tenantId)
    .single()

  const hostelName     = tenant?.name ?? 'Your Hostel'
  const hostelTagline  = tenant?.tagline ?? null
  const hostelPhone    = tenant?.contact_phone ?? null
  const hostelEmail    = tenant?.contact_email ?? null
  const logoUrl        = tenant?.logo_url ?? null
  const tin            = tenant?.tin ?? null
  const vatRegNumber   = tenant?.vat_reg_number ?? null
  const isVatRegistered = tenant?.is_vat_registered ?? false
  const hostelAddress  = [tenant?.address_line1, tenant?.address_city].filter(Boolean).join(', ') || null

  const occupant = Array.isArray(inv.occupant) ? inv.occupant[0] : inv.occupant
  const room     = Array.isArray(inv.room)     ? inv.room[0]     : inv.room
  const cat      = Array.isArray(room?.category) ? room?.category[0] : room?.category
  // Filter for completed payments. The status enum is
  // 'pending' | 'success' | 'failed' | 'reversed' — use 'success'.
  // (The tenant route at /api/invoices/[id]/pdf:56 still uses the wrong
  // 'paid' literal — pre-existing bug to be fixed separately.)
  const payments = (inv.booking_payments ?? []).filter((p: any) => p.status === 'success')

  try {
    const pdfBuffer = await renderToBuffer(
      createElement(InvoicePDF, {
        inv: {
          ...inv,
          invoice_number: (inv as any).invoice_number ?? null,
          vat_amount:     (inv as any).vat_amount     ?? 0,
          nhil_amount:    (inv as any).nhil_amount    ?? 0,
          getfund_amount: (inv as any).getfund_amount ?? 0,
        },
        occupant:     occupant ?? null,
        room:         room     ?? null,
        categoryName: (cat as any)?.name ?? 'Standard',
        payments,
        hostelName,
        hostelTagline,
        hostelAddress,
        hostelPhone,
        hostelEmail,
        logoUrl,
        tin,
        vatRegNumber,
        isVatRegistered,
      }) as React.ReactElement<any>,
    )

    const filename = `invoice-${(inv as any).invoice_number ?? inv.booking_ref}.pdf`

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length':      pdfBuffer.length.toString(),
      },
    })
  } catch (err) {
    console.error('[GET /api/occupant/invoices/[id]/pdf]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'PDF generation failed' },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npm run type-check
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add 'apps/web/app/api/occupant/invoices/[id]/pdf/route.ts'
git commit -m "feat(invoices): GET /api/occupant/invoices/[id]/pdf"
```

---

## Phase 3 — Card component + list page

### Task 3: `InvoiceCard` server component

**Files:**
- Create: `apps/web/components/occupant-portal/invoice-card.tsx`

- [ ] **Step 1: Write the component**

Create `apps/web/components/occupant-portal/invoice-card.tsx`:

```tsx
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface RoomLite { room_number: string | null; block: string | null }

interface Props {
  id:             string
  invoiceNumber:  string | null
  bookingRef:     string
  status:         string
  finalAmount:    number   // pesewas
  paidAmount:     number   // pesewas
  checkInDate:    string | null
  checkOutDate:   string | null
  room:           RoomLite | null
  color:          string
}

const STATUS = {
  paid:      { label: 'Paid',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  partial:   { label: 'Partial',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  unpaid:    { label: 'Unpaid',    cls: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
} as const

function ghs(pesewas: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(pesewas / 100)
}

function date(d: string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d))
}

function deriveStatus(status: string, final: number, paid: number): keyof typeof STATUS {
  if (status === 'cancelled')  return 'cancelled'
  if (paid >= final)           return 'paid'
  if (paid > 0)                return 'partial'
  return 'unpaid'
}

export function InvoiceCard({
  id, invoiceNumber, bookingRef, status, finalAmount, paidAmount,
  checkInDate, checkOutDate, room, color,
}: Props) {
  const key  = deriveStatus(status, finalAmount, paidAmount)
  const pill = STATUS[key]
  const heading = invoiceNumber ?? bookingRef

  return (
    <Link
      href={`/occupant-portal/invoices/${id}`}
      className="block overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-slate-900">{heading}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Room {room?.room_number ?? '—'}{room?.block ? ` · ${room.block}` : ''} · {bookingRef}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${pill.cls}`}>
          {pill.label}
        </span>
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        {date(checkInDate)} — {date(checkOutDate)}
      </p>

      <div className="mt-3 flex items-end justify-between border-t border-slate-100 pt-3">
        <span className="text-base font-bold text-slate-900">{ghs(finalAmount)}</span>
        <span className="flex items-center gap-1 text-xs font-medium" style={{ color }}>
          View <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Type-check (will fail if anything else uses InvoiceCard incorrectly — should pass standalone)**

```bash
cd apps/web && npm run type-check
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/occupant-portal/invoice-card.tsx
git commit -m "feat(invoices): InvoiceCard component"
```

---

### Task 4: List page

**Files:**
- Create: `apps/web/app/(occupant-portal)/occupant-portal/invoices/page.tsx`

- [ ] **Step 1: Write the page**

Create `apps/web/app/(occupant-portal)/occupant-portal/invoices/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { FileText } from 'lucide-react'

import { getOccupantSession } from '@/lib/auth/occupant-session'
import { getOccupantInvoices } from '@/lib/data/occupant-invoices'
import { InvoiceCard } from '@/components/occupant-portal/invoice-card'

export const metadata: Metadata = { title: 'Invoices · My Portal' }

export default async function OccupantInvoicesPage() {
  const session = await getOccupantSession()
  if (!session) redirect('/login')

  const invoices = await getOccupantInvoices(session.occupantId, session.tenantId)

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="text-xl font-bold text-slate-900">Invoices</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Tax-compliant receipts for your bookings.
        </p>
      </header>

      {invoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <FileText className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-500">No invoices yet</p>
          <p className="mt-1 text-xs text-slate-400">Invoices appear here once you have a booking.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv: any) => {
            const room = Array.isArray(inv.room) ? inv.room[0] : inv.room
            return (
              <InvoiceCard
                key={inv.id}
                id={inv.id}
                invoiceNumber={inv.invoice_number ?? null}
                bookingRef={inv.booking_ref}
                status={inv.status}
                finalAmount={inv.final_amount}
                paidAmount={inv.paid_amount}
                checkInDate={inv.check_in_date ?? null}
                checkOutDate={inv.check_out_date ?? null}
                room={room ? { room_number: room.room_number, block: room.block } : null}
                color={session.tenantColor}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npm run type-check
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add 'apps/web/app/(occupant-portal)/occupant-portal/invoices/page.tsx'
git commit -m "feat(invoices): occupant invoices list page"
```

---

## Phase 4 — Detail page

### Task 5: Detail page with download button

**Files:**
- Create: `apps/web/app/(occupant-portal)/occupant-portal/invoices/[id]/page.tsx`

- [ ] **Step 1: Write the page**

Create `apps/web/app/(occupant-portal)/occupant-portal/invoices/[id]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Download } from 'lucide-react'

import { getOccupantSession } from '@/lib/auth/occupant-session'
import { getOccupantInvoiceById } from '@/lib/data/occupant-invoices'

export const metadata: Metadata = { title: 'Invoice · My Portal' }

function ghs(pesewas: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(pesewas / 100)
}

function date(d: string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d))
}

const METHOD_LABEL: Record<string, string> = {
  momo_mtn:        'MTN MoMo',
  momo_vodafone:   'Vodafone Cash',
  momo_airteltigo: 'AirtelTigo Money',
  card:            'Card',
  bank_transfer:   'Bank Transfer',
  bank_draft:      'Bank Draft',
  cash:            'Cash',
  cheque:          'Cheque',
}

export default async function OccupantInvoiceDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const session = await getOccupantSession()
  if (!session) redirect('/login')

  const { id } = await params
  const inv    = await getOccupantInvoiceById(id, session.occupantId, session.tenantId)
  if (!inv) notFound()

  const room = Array.isArray(inv.room) ? inv.room[0] : inv.room
  const cat  = room?.category ? (Array.isArray(room.category) ? room.category[0] : room.category) : null
  const occupant = Array.isArray(inv.occupant) ? inv.occupant[0] : inv.occupant

  const payments     = (inv.booking_payments ?? []).filter((p: any) => p.status === 'success')
  const subtotal     = inv.total_amount ?? inv.final_amount
  const taxAmount    = (inv.vat_amount ?? 0) + (inv.nhil_amount ?? 0) + (inv.getfund_amount ?? 0)
  const total        = inv.final_amount
  const balance      = Math.max(0, inv.final_amount - inv.paid_amount)
  const heading      = inv.invoice_number ?? inv.booking_ref
  const isCancelled  = inv.status === 'cancelled'

  return (
    <div className="space-y-4">
      <Link
        href="/occupant-portal/invoices"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to invoices
      </Link>

      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-lg font-bold text-slate-900">{heading}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Issued {date(inv.created_at)}</p>
          </div>
          {isCancelled && (
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
              Cancelled
            </span>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <Pair label="Resident" value={`${occupant?.first_name ?? ''} ${occupant?.last_name ?? ''}`.trim() || '—'} />
          <Pair label="Booking"  value={inv.booking_ref} mono />
          <Pair label="Room"     value={room?.room_number ? `${room.room_number}${room.block ? ` · ${room.block}` : ''}` : '—'} />
          <Pair label="Stay"     value={`${date(inv.check_in_date)} — ${date(inv.check_out_date)}`} />
          {cat?.name && <Pair label="Type" value={cat.name} />}
          {inv.semester && <Pair label="Semester" value={inv.semester} />}
        </dl>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Line items
        </h2>
        <div className="px-5 py-4 space-y-1.5">
          <Row label={cat?.name ? `${cat.name} accommodation` : 'Accommodation'} value={ghs(subtotal)} />
          {inv.discount_amount > 0 && (
            <Row label={`Discount${inv.discount_reason ? ` — ${inv.discount_reason}` : ''}`} value={`-${ghs(inv.discount_amount)}`} />
          )}
          {inv.vat_amount > 0      && <Row label="VAT (15%)"     value={ghs(inv.vat_amount)} />}
          {inv.nhil_amount > 0     && <Row label="NHIL (2.5%)"   value={ghs(inv.nhil_amount)} />}
          {inv.getfund_amount > 0  && <Row label="GETFund (2.5%)" value={ghs(inv.getfund_amount)} />}
          {taxAmount > 0 && (
            <p className="pt-1 text-right text-[10px] text-slate-400">Tax total: {ghs(taxAmount)}</p>
          )}
        </div>
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
          <Row label="Total" value={ghs(total)} bold />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Payments received
        </h2>
        {payments.length === 0 ? (
          <p className="px-5 py-6 text-center text-xs text-slate-400">No payments recorded yet.</p>
        ) : (
          <div className="px-5 py-3 divide-y divide-slate-100">
            {payments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-700">
                  ✓ {METHOD_LABEL[p.method] ?? p.method} · {date(p.paid_at)}
                </span>
                <span className="font-mono font-semibold text-slate-900">{ghs(p.amount)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 space-y-1.5">
          <Row label="Paid"    value={ghs(inv.paid_amount)} />
          <Row label="Balance" value={ghs(balance)} bold />
        </div>
      </section>

      <a
        href={`/api/occupant/invoices/${inv.id}/pdf`}
        className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white shadow-sm"
        style={{ backgroundColor: session.tenantColor }}
      >
        <Download className="h-4 w-4" /> Download PDF
      </a>
    </div>
  )
}

function Pair({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-sm ${bold ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npm run type-check
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add 'apps/web/app/(occupant-portal)/occupant-portal/invoices/[id]/page.tsx'
git commit -m "feat(invoices): occupant invoice detail page + download button"
```

---

## Phase 5 — Navigation wiring

### Task 6: Bottom nav + home quick-link

**Files:**
- Modify: `apps/web/components/occupant-portal/bottom-nav.tsx`
- Modify: `apps/web/app/(occupant-portal)/occupant-portal/page.tsx`

- [ ] **Step 1: Modify bottom nav**

Open `apps/web/components/occupant-portal/bottom-nav.tsx`. Update the lucide import line + the TABS array.

Find:
```tsx
import { Home, CreditCard, Wrench, Bell, User } from 'lucide-react'
```

Replace with:
```tsx
import { Home, CreditCard, FileText, Wrench, Bell, User } from 'lucide-react'
```

Find the TABS array:
```tsx
const TABS = [
  { href: '/occupant-portal',             label: 'Home',       Icon: Home,       anim: 'pulse'  as IconAnim },
  { href: '/occupant-portal/payments',    label: 'Payments',   Icon: CreditCard, anim: 'flip'   as IconAnim },
  { href: '/occupant-portal/maintenance', label: 'Requests',   Icon: Wrench,     anim: 'swing'  as IconAnim },
  { href: '/occupant-portal/notices',     label: 'Notices',    Icon: Bell,       anim: 'ring'   as IconAnim },
  { href: '/occupant-portal/profile',     label: 'Profile',    Icon: User,       anim: 'bounce' as IconAnim },
]
```

Replace with (Invoices added between Payments and Requests):
```tsx
const TABS = [
  { href: '/occupant-portal',             label: 'Home',       Icon: Home,       anim: 'pulse'  as IconAnim },
  { href: '/occupant-portal/payments',    label: 'Payments',   Icon: CreditCard, anim: 'flip'   as IconAnim },
  { href: '/occupant-portal/invoices',    label: 'Invoices',   Icon: FileText,   anim: 'slide'  as IconAnim },
  { href: '/occupant-portal/maintenance', label: 'Requests',   Icon: Wrench,     anim: 'swing'  as IconAnim },
  { href: '/occupant-portal/notices',     label: 'Notices',    Icon: Bell,       anim: 'ring'   as IconAnim },
  { href: '/occupant-portal/profile',     label: 'Profile',    Icon: User,       anim: 'bounce' as IconAnim },
]
```

- [ ] **Step 2: Modify home page quick-links**

Open `apps/web/app/(occupant-portal)/occupant-portal/page.tsx`. Find the Quick links section. The existing array of links is rendered inside `{[...].map(...)}`. Add a new entry for Invoices between the existing "View payment history" and "Maintenance requests" entries.

Find:
```tsx
{ href: '/occupant-portal/payments',    icon: CreditCard, label: 'View payment history',    sub: 'Fees paid and outstanding balance'  },
{ href: '/occupant-portal/maintenance',  icon: Wrench,     label: 'Maintenance requests',    sub: 'Track submitted issues'              },
```

Replace with:
```tsx
{ href: '/occupant-portal/payments',    icon: CreditCard, label: 'View payment history',    sub: 'Fees paid and outstanding balance'  },
{ href: '/occupant-portal/invoices',    icon: FileText,   label: 'View invoices',           sub: 'Download tax-compliant receipts'    },
{ href: '/occupant-portal/maintenance',  icon: Wrench,     label: 'Maintenance requests',    sub: 'Track submitted issues'              },
```

The `FileText` icon needs to be in the lucide-react import. Find at the top of the file:
```tsx
import {
  BedDouble, CreditCard, Wrench, AlertCircle,
  CheckCircle2, Clock, XCircle, ChevronRight,
  Bell, ArrowRight, Calendar,
} from 'lucide-react'
```

Add `FileText`:
```tsx
import {
  BedDouble, CreditCard, FileText, Wrench, AlertCircle,
  CheckCircle2, Clock, XCircle, ChevronRight,
  Bell, ArrowRight, Calendar,
} from 'lucide-react'
```

- [ ] **Step 3: Type-check**

```bash
cd apps/web && npm run type-check
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/occupant-portal/bottom-nav.tsx \
        'apps/web/app/(occupant-portal)/occupant-portal/page.tsx'
git commit -m "feat(invoices): bottom-nav tab + home quick-link tile"
```

---

## Phase 6 — Documentation

### Task 7: TESTING.md UAT phase

**Files:**
- Modify: `TESTING.md`

- [ ] **Step 1: Append the UAT phase**

From the worktree root:

```bash
cat >> TESTING.md <<'EOF'

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
EOF
echo "appended TESTING.md"
```

- [ ] **Step 2: Commit**

```bash
git add TESTING.md
git commit -m "docs(testing): invoice viewing UAT phase"
```

---

## Phase 7 — Final smoke test + PR

### Task 8: End-to-end manual smoke test

**Files:** none

- [ ] **Step 1: Start dev server**

```bash
cd apps/web && npm run dev
```

Expected: server starts on `http://localhost:3000` without errors.

If the server fails because `.env.local` is missing, copy it from the main checkout (Task 0 step 5). If you don't need to test against a real DB locally and only want a build smoke-test, run `npm run build` instead.

- [ ] **Step 2: Walk through the happy path**

In a browser:
1. Log in as a test occupant.
2. Click the Invoices tab in the bottom nav.
3. Verify the list renders with the correct status pills.
4. Click any card.
5. Verify the detail page renders (line items, payments, totals).
6. Click "Download PDF".
7. Verify file downloads + opens correctly.

- [ ] **Step 3: Walk through edge cases**

8. Log in as a different occupant. Try `/occupant-portal/invoices/<first-occupant's-booking-id>` directly. Should show 404 page.
9. Same with `/api/occupant/invoices/<first-occupant's-booking-id>/pdf`. Should return 404 JSON.
10. Log out. Try `/occupant-portal/invoices`. Should redirect to login.

- [ ] **Step 4: If anything fails, file a follow-up issue and continue.**

Don't try to fix in this PR unless it's a blocker. Document with the symptom + repro.

---

### Task 9: Open the PR

**Files:** none

- [ ] **Step 1: Push the branch**

From the worktree root:
```bash
git push -u origin $(git branch --show-current)
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "feat: student portal invoice viewing & download (sub-project 2 of 4)" --body "$(cat <<'EOF'
## Summary

- New `/occupant-portal/invoices` list + detail page + PDF download for the resident portal
- Reuses existing `<InvoicePDF>` component (`@react-pdf/renderer`) and `bookings` schema with no migrations
- Cancelled bookings are listed and downloadable per spec decision
- Old invoices (post-checkout) remain accessible

## Spec & roadmap

- Spec: `docs/superpowers/specs/2026-05-05-student-portal-invoices-design.md`
- Roadmap: `docs/superpowers/2026-05-05-sub-projects-2-4-roadmap.md`

## What's NOT in this PR

- No schema changes
- No new notifications
- Refund line items (current behavior nets refunds into `paid_amount`)

## Pre-existing bug noted

The tenant-side `/api/invoices/[id]/pdf` route at line 56 filters payments by `p.status === 'paid'` but the actual `booking_payments` enum is `'pending' | 'success' | 'failed' | 'reversed'`. This means tenant-generated PDFs currently show empty payment sections. The new occupant route uses the correct `'success'` literal. Tenant route should be patched in a follow-up PR.

## Test plan

See `TESTING.md` → **Phase — Invoice Viewing & Download** for the full UAT checklist.

- [ ] Listing page renders with correct status pills (paid/partial/unpaid/cancelled)
- [ ] Detail page shows line items, taxes, payments, totals
- [ ] PDF downloads with correct filename and renders correctly
- [ ] Cross-occupant URL guess returns 404
- [ ] Logged-out access redirects to login
- [ ] Cancelled bookings listed + downloadable
EOF
)"
```

- [ ] **Step 3: Surface the PR URL** to the controller / user.

---

## Self-review notes

- **No automated tests** — same project policy as sub-project 1. Manual UAT in TESTING.md is the QA artifact.
- **`booking_payments.status === 'success'` not `'paid'`** — explicitly called out in Task 2 to match the actual enum and avoid copying the pre-existing tenant-side bug.
- **No schema migrations** — this whole sub-project is portal-side surface over existing data; nothing to apply on Supabase.
- **`(inv as any)` casts** likely needed in Task 4/5 for fields not yet in regenerated Supabase types (`invoice_number`, tax columns) — same pattern as sub-project 1 used. Not pre-emptively casted in the plan; only add casts where the implementer hits a real type error.
- **Bottom-nav crowding** — going from 5 to 6 tabs at 60px each = 360px wide. Tight on iPhone SE (320px) but works on iPhone X+ (375px+). If 320px coverage is required, reduce icon labels to single-letter or remove the Profile tab (since it's reachable from the user avatar elsewhere). Not addressed in this plan; flag if it's a problem in UAT.
