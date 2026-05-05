# Student Portal — Invoice Viewing & Download

**Status:** approved design (ready for implementation plan)
**Date:** 2026-05-05
**Sub-project:** 2 of 4 (Payments → **Invoices** → Real-time issue reporting → Food ordering)
**Roadmap:** `docs/superpowers/2026-05-05-sub-projects-2-4-roadmap.md`

---

## 1. Goal

Let students view and download GRA-compliant invoices for their bookings from the resident portal. Reuses the existing tenant-side PDF generator (`@react-pdf/renderer` + `<InvoicePDF>`) with no schema changes — the surface is purely a portal-side wrapper around existing data.

## 2. Non-goals

- Per-line-item disputes or annotations
- Editing invoices (admin-only via the existing tenant route)
- Payment from the invoice page (payment lives on `/occupant-portal/payments` — bank-draft + Paystack flows already shipped in sub-project 1)
- Refund line items (out of scope; current refund handling nets into `paid_amount`)
- Multi-invoice-per-booking (one booking = one invoice; semester / utility splits would need their own sub-project)
- Snapshot / immutable issuance (current model regenerates PDF on each render from the live booking row)

## 3. User stories

| As a... | I want to... | So that... |
|---|---|---|
| Student | See a list of all my invoices | I have a single place to find tax docs |
| Student | Download a tax-compliant PDF | I can submit it for sponsor reimbursement / records |
| Student | See cancelled bookings' invoices too | I can prove what I paid before cancellation |
| Student | Access old invoices after checkout | I don't have to call reception for a 6-month-old receipt |

## 4. Architecture overview

```
Bottom nav: Invoices tab
  │
  ▼
/occupant-portal/invoices              (NEW server component, list of cards)
  │
  ▼ (tap card)
/occupant-portal/invoices/[id]         (NEW server component, detail view)
  │
  ▼ (Download PDF button)
/api/occupant/invoices/[id]/pdf        (NEW route — occupant-gated)
  │
  └─→ renders <InvoicePDF> component (existing, shared with /api/invoices/[id]/pdf)
```

No new tables, no new buckets. All data sourced from existing `bookings` row joined with `occupants`, `rooms`, `room_categories`, `booking_payments`, `tenants`. The `invoice_number` column added by migration 008 is rendered in the list and the PDF.

## 5. Decisions log

| # | Decision | Choice |
|---|---|---|
| 1 | Invoice model | A — one invoice per booking (matches existing tenant-side) |
| 2 | Cancelled bookings | C — show in list + downloadable, with "Cancelled" badge |
| 3 | Access duration | A — forever while occupant has account |
| 4 | List UI | A — card stack matching portal design language |
| 5 | Detail view | A — separate page at `/occupant-portal/invoices/[id]` |
| 6 | PDF route | A — new occupant-gated route reusing `<InvoicePDF>` component |
| 7 | Navigation placement | A — standalone Invoices tab in bottom nav |

## 6. File inventory

**New (5):**

| Path | Responsibility |
|---|---|
| `apps/web/app/(occupant-portal)/occupant-portal/invoices/page.tsx` | Server component — list view, fetches via `getOccupantInvoices()` |
| `apps/web/app/(occupant-portal)/occupant-portal/invoices/[id]/page.tsx` | Server component — detail view, fetches via `getOccupantInvoiceById()` |
| `apps/web/app/api/occupant/invoices/[id]/pdf/route.ts` | GET — occupant-gated PDF response (Buffer + Content-Disposition) |
| `apps/web/components/occupant-portal/invoice-card.tsx` | Server component — single card with status pill |
| `apps/web/lib/data/occupant-invoices.ts` | Data helpers: list + single fetch, both occupant-scoped |

**Modified (2):**

| Path | Change |
|---|---|
| `apps/web/components/occupant-portal/bottom-nav.tsx` | Add Invoices tab (FileText icon) |
| `apps/web/app/(occupant-portal)/occupant-portal/page.tsx` | Add "View invoices" tile to the quick-links section |

**Reused unchanged:**
- `apps/web/components/invoices/invoice-pdf.tsx` (the `<InvoicePDF>` PDF component)
- `apps/web/lib/data/invoices.ts` may export `getInvoiceById` for reuse, OR the new `lib/data/occupant-invoices.ts` may duplicate the query with the occupant filter inlined — implementation can decide based on whether the existing helper is cleanly tenant-agnostic. (See Implementation Notes.)

## 7. Schema

**No changes.** Migration 008 already added `invoice_number` and the GRA tax columns. All other fields used by the PDF (`final_amount`, `paid_amount`, `tax_amount`, `vat_amount`, `nhil_amount`, `getfund_amount`, `discount_amount`, `discount_reason`, `semester`, `academic_year`, `source`) exist on `bookings`.

## 8. Auth

| Route | Gate |
|---|---|
| `/occupant-portal/invoices` | `getOccupantSession()` — redirects to `/login` if missing |
| `/occupant-portal/invoices/[id]` | Same. Server fetch filters by `tenant_id = session.tenantId AND occupant_id = session.occupantId` — invalid id returns 404 page (`notFound()`) |
| `/api/occupant/invoices/[id]/pdf` | Same — 401 if no session, 404 if booking not owned |

The booking ownership check is the only access boundary. RLS on `bookings` is already in place from migration 002 (`occupant_can_read_own_booking` policy or equivalent — confirm during impl).

## 9. UI

### List page

- Header: "Invoices" + subtitle "Tax-compliant receipts for your bookings."
- Card per booking, sorted `created_at DESC`.
- Each card shows:
  - Top row: invoice number (or `booking_ref` fallback) + status pill
  - Room number + booking ref
  - Stay dates (`check_in_date` — `check_out_date`)
  - Total amount in GHS
  - "View →" affordance
- Status pill mapping:
  - **Paid** (emerald) — `paid_amount >= final_amount` AND status ≠ cancelled
  - **Partial** (amber) — `0 < paid_amount < final_amount`
  - **Unpaid** (red) — `paid_amount === 0`
  - **Cancelled** (slate) — `status === 'cancelled'` (overrides the others)
- Empty state: dashed-border card, FileText icon, "No invoices yet. Invoices appear here once you have a booking."

### Detail page

- Back link to list
- Invoice number + issue date (use `created_at`)
- Hostel / Resident / Room / Stay metadata block
- Line items section (room rent calculated from `rate_per_unit × duration`, taxes shown as separate lines per the PDF's existing logic)
- Payments received section (rows from `booking_payments WHERE status='success'`)
- Totals: Subtotal / Total / Paid / Balance
- Sticky bottom button: **Download PDF** → `/api/occupant/invoices/[id]/pdf`

### PDF

- Reuses `<InvoicePDF>` exactly as the tenant route uses it.
- Filename: `{invoice_number}.pdf` (or `{booking_ref}.pdf` if no invoice_number).
- `Content-Disposition: attachment; filename="..."` so browser saves rather than inlines.

## 10. Edge cases

| # | Case | Handling |
|---|---|---|
| 1 | Booking has no `invoice_number` (legacy) | List shows `booking_ref` instead. PDF still renders. |
| 2 | Cancelled booking | Listed with slate badge. PDF downloadable. Reflects final_amount + paid_amount at cancellation. |
| 3 | `final_amount = 0` | Listed with green Paid pill. PDF shows GH₵ 0.00. |
| 4 | Refunded booking | `paid_amount` already net of refunds via existing trigger. PDF shows net. Refund line items out of scope. |
| 5 | Direct URL guess: cross-tenant ID | Filter excludes → 404 |
| 6 | Direct URL guess: same tenant, different occupant | Same — 404 |
| 7 | 30+ payments on one booking | Iterate all in PDF + detail page. No pagination at student-portal scale. |
| 8 | PDF render throws | Route returns 500 with `{ error: 'Could not render invoice' }` |
| 9 | Concurrent payment recorded between page load and download | Stale snapshot in browser; re-download on next session shows latest. Acceptable. |
| 10 | Occupant has no bookings | Empty state on list. PDF route returns 404 for any id (none owned). |

## 11. Notifications

**None.** Invoice viewing is passive. No push, no SMS triggered by this sub-project.

(If a "new invoice issued" notification ever becomes desirable, it would tie to booking creation in a future feature, not this one.)

## 12. Testing strategy

Following SP 1's pattern — no automated test framework in this project.

### Manual UAT (append to `TESTING.md`)

Phase — Invoice Viewing & Download:

- [ ] Bottom nav shows "Invoices" tab
- [ ] `/occupant-portal/invoices` lists all bookings as cards (paid, partial, unpaid, cancelled)
- [ ] Status pills match expected color per booking state
- [ ] Tap card → detail page loads with line items + payments
- [ ] Download PDF button returns a file named `{invoice_number}.pdf`
- [ ] PDF renders correctly: hostel header, resident, room, line items, taxes, payment history, totals
- [ ] Cancelled booking shows slate "Cancelled" badge AND can be downloaded
- [ ] Old booking after checkout still appears in list
- [ ] Direct URL `/occupant-portal/invoices/<id>` for another occupant's invoice → 404 page
- [ ] Direct URL to `/api/occupant/invoices/<id>/pdf` for another occupant → 404 JSON
- [ ] `/occupant-portal` home page shows "View invoices" quick-link tile
- [ ] Empty-state copy renders for occupant with no bookings

### Type safety

`cd apps/web && npm run type-check` after each file change.

## 13. Implementation notes

These are guides for the implementer (writing-plans skill will translate into bite-sized tasks):

1. **Reuse vs duplicate `getInvoiceById`:** the existing `lib/data/invoices.ts` uses `getServerTenantId()` for tenant scoping but doesn't filter by occupant. Two clean options: (a) add an `occupantId` parameter to the existing helper, OR (b) inline the query in `lib/data/occupant-invoices.ts`. Option (a) keeps a single source of truth for the SELECT shape; option (b) avoids changing tenant-side behavior. Lean toward (b) — the queries are short, and isolating occupant logic makes the auth guarantees easier to read.

2. **Bottom nav slot:** the existing `bottom-nav.tsx` lays out tabs in a fixed grid. Adding Invoices may push it from N to N+1 cells; verify the layout still fits on a 360px-wide phone before commit.

3. **PDF route mime + filename:** copy the response shape from `apps/web/app/api/invoices/[id]/pdf/route.ts`. Make sure `Content-Disposition: attachment; filename="..."` is on the response so the browser saves rather than inlines (some browsers inline PDFs by default).

4. **Status pill for cancelled:** the cancellation overrides paid status. If a booking is paid AND cancelled, show only "Cancelled" — paid status is irrelevant context.

5. **Hostel name in PDF header:** the existing PDF route fetches tenant name + tenant logo + tax info via the `x-tenant-id` header. The occupant route can use `session.tenantId` directly — same data, no header dependency.

## 14. Estimated scope

| Component | Complexity |
|---|---|
| List page | trivial |
| Detail page | small (mostly reused PDF data shape) |
| PDF route | small (copy of tenant route with auth swap) |
| Bottom nav update | trivial |
| Quick-link tile | trivial |
| Manual UAT | trivial |

**Total: 1 working day** at SP 1's care level (full two-stage code review per bundle, type-check after each step, manual UAT).

---

**Next step after approval of this spec:** invoke the `writing-plans` skill to produce the implementation plan with task-by-task breakdown.
