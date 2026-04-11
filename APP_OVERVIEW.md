# AbrempongHMS — What's Been Built

## Architecture Overview

**Multi-tenant SaaS** — one codebase serves multiple hostels. Each hostel (tenant) gets their own subdomain (e.g., `unity.abrempong.com`) or custom domain. The middleware resolves which hostel you're on from the hostname, injects it as headers, and all data is isolated per tenant via Postgres Row Level Security.

**Stack:** Next.js 15 (App Router) · Supabase (Postgres + Auth + Storage) · Tailwind CSS · TypeScript

---

## The Two Sides of the App

### 1. Tenant Dashboard (`/dashboard` and all protected routes)
The hostel management interface — what hostel staff log into.

### 2. Public Booking Page (`/{slug}/book` or custom domain)
What prospective occupants see to make bookings — no login required.

---

## Modules Built

### Core Operations

**Dashboard** `/dashboard`
KPI cards (occupancy rate, revenue, pending payments, active bookings), recent activity feed, alerts panel.

**Rooms** `/rooms`
- List all rooms with status (available/occupied/maintenance), housekeeping status, category
- Room detail page — full booking history, inspection log, quick status actions
- Create/edit rooms with block, floor, capacity, amenities

**Occupants** `/occupants`
- Full resident directory with search
- Occupant detail — contact info, academic info (institution, programme, year), emergency contact, booking history, uploaded documents
- ID Verification queue (`/occupants/id-verification`) — staff review uploaded ID documents, approve/reject with notes

**Bookings** `/bookings`
- List with status filters (pending payment / confirmed / checked in / checked out / cancelled)
- Calendar view (`/bookings/calendar`) — 14-day Gantt grid showing which rooms are booked when, with colour-coded booking bars
- Booking detail — check in/out actions, payment recording, status transitions
- New booking flow linked from room or occupant pages

**Invoices** `/invoices`
- Auto-generated per booking
- PDF export
- Tax line items support

**Payments**
- Record payments against bookings (cash, MoMo, bank transfer)
- Paystack integration for online card/MoMo payments

---

### HR & Staff

**Staff** `/staff`
- Staff directory — name, role, department, contact
- Staff detail — employment info, payroll records, shift assignments
- Payroll management (`/staff/payroll/[id]`) — salary, allowances, deductions, payment history

**Housekeeping** `/housekeeping`
- Task board — assign cleaning tasks to staff, track status (pending/in progress/done)
- Linked to room housekeeping status

---

### Operations

**Maintenance** `/maintenance`
- Work order list — report issues, assign to staff, track resolution
- Maintenance detail with photo attachments
- **Preventive Maintenance Schedules** (`/maintenance/schedules`) — recurring task templates (daily/weekly/monthly/annual), auto-tracks overdue schedules
- **Meter Readings** (`/maintenance/meters`) — track electricity/water/gas meter readings per room

**Assets** `/assets`
- Register all furniture and equipment with category, brand, model, serial number
- QR code per asset — printable, scannable to pull up the asset record
- Asset detail page — full purchase info, warranty tracking, location
- Status tracking: active / under maintenance / disposed / lost

**Lost & Found** `/lost-found`
- Log found items, claim resolution, occupant linkage

**Security** `/security`
- Visitor pass log
- Blacklist management — flag occupants as warned or banned, with reason and expiry
- Blacklisted occupants show a banner on their profile page

**Key Management** — track physical room keys issued/returned

---

### Finance & Accounting

**Full double-entry accounting** under `/accounting`:
- **Chart of Accounts** — assets, liabilities, equity, revenue, expenses
- **Journal** — every transaction posted as debit/credit entries
- **Trial Balance** — debits vs credits balanced view
- **P&L (Income Statement)** — revenue minus expenses for any date range
- **Balance Sheet** — assets = liabilities + equity check
- **Cash Flow** — direct method, grouped by transaction source
- **Bank Reconciliation** — upload bank statement CSV, match against journal

**Expenses** `/accounting/expenses` — log operational expenses by category

**Damage Deposits** — track deposit held, deductions, refunds

**Installment Plans** — split booking payments into scheduled installments

---

### Communications

**SMS & Email** `/communications`
- Send bulk SMS blasts to filtered occupant groups
- Message history log

**Notices** `/communications/notices`
- Post announcements to all or specific occupants

**Notification Templates** — customise the SMS/email messages sent automatically on booking confirmation, check-in, payment receipt, etc.

---

### Intelligence & AI

**Reports** `/reports`
- Standard reports: occupancy, revenue, housekeeping performance, staff
- **Custom Report Builder** (`/reports/custom`) — pick metric (revenue/bookings/occupancy), date range, group-by dimension, see results table with CSV export

**Anomaly Detection** `/intelligence/anomalies`
- Flags unusual patterns: sudden occupancy drop, payment spikes, overdue maintenance clusters

**AI Assistant** `/ai`
- Chat interface powered by Claude
- Can answer questions like "what rooms are available next week?", "what's our revenue this month?", "do we have a standard rate for postgrad students?"
- Tools: check availability, get pricing, search FAQs, escalate to human

---

### Multi-Property & Admin

**Portfolio View** `/portfolio`
- For operators managing multiple hostels — unified KPIs across all properties on one screen

**Platform Super-Admin** `/admin`
- Tenant list with plan/status/billing info
- Per-tenant management (suspend, upgrade plan, view stats)
- Usage metrics across the whole platform

---

### Settings

**Profile** — hostel name, tagline, contact details, address
**Branding** — logo upload, primary colour (applied to invoices and booking page)
**Notifications** — toggle SMS / email / MoMo channels
**Security** — password change, custom domain, webhook endpoints, notification templates, rate management, AI agent config

---

### Public Booking Page

`/book` (served on tenant subdomain or custom domain)
- Multi-step flow: pick room type → pick dates → fill occupant details → pay
- Supports Paystack for online payment or "pay on arrival"
- Occupant portal `/portal` — existing occupants can log in to view their booking, download invoice, make payments

---

## How Tenant Resolution Works (Local Dev)

On **localhost**, there's no subdomain, so the middleware falls back to reading `tenant_id` from your **JWT claims**. The `custom_access_token_hook` Postgres function injects your hostel's `tenant_id` into the JWT when you sign in. That's why the hook fix was critical — without it, the JWT has no tenant context and every page shows "Could not load tenant configuration."

### Tenant Resolution Flow
```
Request arrives
      │
      ▼
Is hostname localhost / app.abrempong.com?
      │
   YES│                          NO
      │                           │
      ▼                           ▼
Read tenant_id              Resolve subdomain
from JWT claims             or custom domain
(set by hook on login)      → query tenants table
      │                           │
      └──────────┬────────────────┘
                 ▼
        Inject x-tenant-id header
        (all server components read this)
```

---

## Testing Checklist

### Auth Flow
- [ ] Sign up → onboarding (creates tenant + first user in `tenant_members`)
- [ ] Sign in → lands on `/dashboard`
- [ ] Forgot password flow

### Core Booking Loop
- [ ] Create a room category (e.g. "Single Room", GH₵ 800/month)
- [ ] Create a room (Room 101, Single Room category)
- [ ] Add an occupant
- [ ] Create a booking (occupant → room → dates)
- [ ] Record a payment
- [ ] Check in the occupant → room status should flip to "occupied"
- [ ] Generate and download invoice PDF

### Operations
- [ ] Create a maintenance request
- [ ] Assign a housekeeping task
- [ ] Add a staff member

### Public Booking Page
- [ ] Visit `localhost:3000/book` (or your tenant slug URL) — should show the booking form

### Finance
- [ ] Check that a booking payment creates a journal entry
- [ ] View P&L report for current month
- [ ] Export a custom report to CSV

### AI Assistant
- [ ] Ask "What rooms are available this weekend?"
- [ ] Ask "What is the rate for a single room?"

---

## Key Environment Variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key (bypasses RLS) |
| `ANTHROPIC_API_KEY` | Powers the AI Assistant |
| `ARKESEL_API_KEY` | SMS sending (Ghana) |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Online payments |
| `PAYSTACK_SECRET_KEY` | Paystack server-side |
| `UPSTASH_REDIS_REST_URL` | Tenant resolution cache |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web push notifications |

---

## Database Schema (Key Tables)

| Table | Purpose |
|---|---|
| `tenants` | One row per hostel |
| `tenant_members` | Users → tenants mapping (with role) |
| `rooms` | Physical rooms |
| `room_categories` | Room types with pricing |
| `occupants` | Residents |
| `bookings` | Booking records |
| `invoices` / `invoice_line_items` | Billing |
| `payments` | Payment records |
| `staff` | Employee records |
| `maintenance_requests` | Work orders |
| `assets` | Asset register |
| `journal_entries` / `journal_lines` | Double-entry accounting |
| `chart_of_accounts` | Account definitions |
| `sms_blasts` | Bulk communication log |
| `platform_admins` | Super-admin users |
