# GH Hostels — Hostel Management System
## Comprehensive Architecture & Product Plan
### Tailored for the Ghanaian Market

> **Revision 4.0 — AI-Powered Premium Website Added**
> Updated to use Supabase (auth + database), per-hostel custom domains with white-labeling,
> and Vercel for hosting. Designed to launch at near-zero infrastructure cost.
> Revision 3.0: Public Website Integration — JS embed widget, hosted booking page, public API.
> Revision 4.0: AI-Powered Premium Website — 4 premium templates with visual CMS, plus a
> Voice & Chat AI agent (Vapi + Claude) that answers questions, books rooms, and processes
> MoMo payments autonomously 24/7, including via dedicated phone number.

---

## TABLE OF CONTENTS

1.  [Product Vision & Ghanaian Market Context](#part-1)
2.  [Infrastructure & Hosting Strategy](#part-2)
3.  [Multi-Tenant Architecture](#part-3)
4.  [White-Labeling & Custom Domain System](#part-4)
5.  [Public Website Integration](#part-4b)
6.  [AI-Powered Premium Website](#part-4c)
7.  [Offline-First PWA Architecture](#part-5)
8.  [Module Specifications](#part-6)
9.  [Role-Based Access Control & Auth](#part-7)
10. [Data Model Design](#part-8)
11. [Technology Stack](#part-9)
12. [Startup Cost Breakdown](#part-10)
13. [UX Design Philosophy](#part-11)
14. [Owner Intelligence: The "Eye & Ear" Features](#part-12)
15. [Phased Implementation Roadmap](#part-13)

---

## PART 1 — PRODUCT VISION & GHANAIAN MARKET CONTEXT

### 1.1 Product Identity

**Name:** `GH Hostels`
*(GH Hostels = "nobleman/person of stature" in Twi — connoting prestige and trustworthiness)*

**Tagline:** *"Every Room. Every Cedi. Every Moment — In Your Hands."*

**Mission:** Empower Ghanaian hostel owners with total visibility and control over their
properties through a modern, resilient, offline-capable platform purpose-built for local realities.

---

### 1.2 Ghanaian Market Realities & Design Imperatives

| Reality | Design Response |
|---|---|
| Unreliable internet (ECG outages, data bundles) | Offline-first PWA with full local state |
| Mobile money dominance (MTN MoMo, Vodafone Cash, AirtelTigo) | Native MoMo payment rails, not just card |
| Students as primary occupants (KNUST, UG, UCC, Legon, etc.) | Student ID / Ghana Card intake, semester-based billing |
| Predominantly Android, low-mid range devices | Aggressive performance budget, minimal JS payload |
| SMS still dominant for notifications | Arkesel / Hubtel SMS gateway integration |
| GHS currency & Ghana Revenue Authority (GRA) compliance | GHS-first, VAT invoicing, NHIL, GETFund levy compliance |
| Low digital literacy among some staff | Role-specific UIs — simplified views for housekeeping staff |
| Distrust of cloud-only solutions | Local-first data with transparent sync, data ownership clarity |
| Multiple languages (English, Twi, Ewe, Hausa, Ga) | i18n foundation with Twi as first local language |
| High student turnover (semester-based) | Batch operations: mass check-in/check-out, bulk invoicing |

---

### 1.3 Core Design Principles

1. **Offline First, Cloud Enhanced** — The app must be fully functional with zero internet
2. **Owner Omniscience** — Every material action generates an auditable trail visible to owner
3. **Ghana-Native** — MoMo, GHS, GRA, Ghana Card — not bolted on, but foundational
4. **Role-Appropriate Simplicity** — Each role sees only what they need, with the right UX depth
5. **Startup-Smart** — Leverage managed services (Supabase, Vercel) to eliminate infrastructure ops
6. **Each Hostel Owns Its Identity** — Custom domain, custom branding — no GH Hostels watermark unless the hostel wants it
7. **Real-Time Awareness** — Owners get live dashboards, push alerts, and anomaly flags

---

## PART 2 — INFRASTRUCTURE & HOSTING STRATEGY

### 2.1 Recommended Hosting Stack

```
┌──────────────────────────────────────────────────────────────────┐
│                    HOSTING OVERVIEW                              │
│                                                                  │
│  VERCEL                   SUPABASE               UPSTASH         │
│  ─────────────────        ──────────────────     ─────────────── │
│  Next.js Frontend         PostgreSQL DB          Serverless Redis │
│  + API Routes             Supabase Auth          (cache + queues) │
│  + Edge Middleware        Supabase Storage                        │
│  + Custom Domains         Supabase Realtime                       │
│  (tenant resolution)      Row Level Security                      │
│                                                                  │
│  TRIGGER.DEV              ARKESEL / HUBTEL       CLOUDFLARE       │
│  ─────────────────        ──────────────────     ─────────────── │
│  Background Jobs          SMS Gateway            DNS + CDN        │
│  (SMS, reports,           MoMo Payments          DDoS Protection  │
│   invoices, sync)         WhatsApp API           SSL (auto)       │
└──────────────────────────────────────────────────────────────────┘
```

---

### 2.2 Vercel vs Netlify — Recommendation

**Use Vercel. Here is why:**

| Criteria | Vercel | Netlify |
|---|---|---|
| Next.js App Router support | Native (built by same team) | Third-party adapter |
| Edge Middleware | Full support — critical for tenant resolution | Limited |
| Custom domain API | Yes — add domains programmatically | Yes — also supported |
| SSL per custom domain | Auto-provisioned, instant | Auto-provisioned |
| Serverless functions | Excellent, globally distributed | Good |
| Free tier bandwidth | 100GB/month | 100GB/month |
| Free tier builds | 6,000 min/month | 300 min/month |
| Image optimisation | Built-in (Next.js Image) | Plugin required |
| Analytics | Built-in (Web Analytics) | Add-on |
| Real-time logs | Yes | Yes |

**The decisive reason:** Vercel's **Edge Middleware** runs before any page renders, at the
CDN edge node closest to the user. This is exactly where we resolve which tenant a request
belongs to — reading the hostname, looking up the tenant from cache, and injecting the
tenant context. On Vercel this runs in <1ms globally. On Netlify, equivalent functionality
requires Edge Functions with more setup and higher latency.

Additionally, Vercel's **Domains API** allows you to programmatically add a hostel's custom
domain to your deployment — SSL certificate included, provisioned in seconds. This is how
Cal.com, Hashnode, Vercel itself, and hundreds of other multi-tenant SaaS apps work.

---

### 2.3 High-Level Request Flow

```
User visits: www.acaciahostel.com (custom domain)
    │
    ▼
Cloudflare DNS (CNAME → vercel-dns.com)
    │
    ▼
Vercel Edge Network
    │
    ▼
Next.js Edge Middleware (runs at CDN edge)
  - Reads: request.headers.get('host') → "www.acaciahostel.com"
  - Looks up: Upstash Redis → tenant_id: "tid_0042", slug: "acacia"
  - Cache miss? → Query Supabase public.tenants → cache result
  - Injects headers: x-tenant-id, x-tenant-slug, x-tenant-plan
    │
    ▼
Next.js App Router (Server Components)
  - Reads tenant context from headers
  - Fetches tenant branding (logo, colours, name) from Supabase
  - Renders page with hostel-specific branding
    │
    ▼
Supabase (PostgreSQL + Auth + Storage + Realtime)
  - All DB queries filtered by RLS using JWT tenant_id claim
  - Auth validates JWT, extracts tenant_id + role claims
  - Storage serves hostel logo, receipts, documents
  - Realtime pushes live events to owner dashboard
```

---

## PART 3 — MULTI-TENANT ARCHITECTURE

### 3.1 Tenancy Model: Single Schema + Row Level Security (RLS)

**Why changed from schema-per-tenant:**

The original design proposed schema-per-tenant PostgreSQL. This is architecturally sound
but Supabase's managed database, Studio, and migration tooling are optimised for a single
schema with RLS. Schema-per-tenant on Supabase creates operational friction:
- Supabase Studio cannot navigate between schemas easily
- Every database migration must run N times (once per tenant schema)
- Supabase's built-in pooler (PgBouncer) doesn't support `search_path` switching

**The Supabase-native approach: RLS with tenant_id**

Every tenant-scoped table carries a `tenant_id` column. PostgreSQL Row Level Security
policies enforce that users can only see rows where `tenant_id` matches the value in
their JWT claim. This happens at the database level — no application code needed.

```sql
-- Example: rooms table with RLS
CREATE TABLE rooms (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id),
    -- ... other fields
);

-- RLS policy: users only see their tenant's rooms
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON rooms
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

**Security guarantees:**
- Even if application code forgets to filter by tenant_id, RLS blocks cross-tenant data
- RLS operates at the PostgreSQL query planner level — no bypass possible from app layer
- Each Supabase client is authenticated with a JWT that carries the tenant_id claim
- The service role key (used only in API Routes/Edge Functions) bypasses RLS only when
  explicitly needed (e.g., cross-tenant admin operations — only super_admin role)

---

### 3.2 Tenant JWT Claims Architecture

Supabase Auth generates JWTs for every logged-in user. We extend these JWTs with
custom claims using a **PostgreSQL function hook** that runs on every token generation:

```sql
-- Function that Supabase Auth calls when generating a JWT
CREATE OR REPLACE FUNCTION public.custom_jwt_claims(user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'tenant_id',   tm.tenant_id,
    'role',        tm.role,
    'staff_id',    tm.staff_id,
    'tenant_slug', t.slug,
    'tenant_plan', t.plan
  )
  INTO result
  FROM public.tenant_members tm
  JOIN public.tenants t ON t.id = tm.tenant_id
  WHERE tm.user_id = $1
    AND tm.is_active = true
  LIMIT 1;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;
```

**Resulting JWT payload:**
```json
{
  "sub": "usr_abc123",
  "email": "owner@acaciahostel.com",
  "tenant_id": "tid_0042",
  "role": "owner",
  "staff_id": "stf_xyz",
  "tenant_slug": "acacia",
  "tenant_plan": "growth",
  "exp": 1735689600
}
```

All RLS policies read `auth.jwt() ->> 'tenant_id'` and `auth.jwt() ->> 'role'`
to enforce both data isolation and permission checks.

---

### 3.3 Database Schema Structure

```
Supabase PostgreSQL (single schema: public)

PLATFORM TABLES (shared, no tenant_id):
  public.tenants              ← tenant registry
  public.tenant_members       ← who belongs to which tenant + their role
  public.tenant_config        ← branding, domain, settings per tenant
  public.subscription_plans   ← Starter/Growth/Enterprise plan definitions

TENANT-SCOPED TABLES (all have tenant_id, all protected by RLS):
  public.properties           ← hostel buildings
  public.rooms                ← individual rooms
  public.room_types           ← single/double/ensuite/dorm
  public.occupants            ← residents/students
  public.bookings             ← room bookings
  public.invoices             ← billing
  public.invoice_line_items
  public.payments
  public.journal_entries      ← accounting
  public.journal_lines
  public.staff                ← employee records
  public.attendance
  public.payroll_runs
  public.housekeeping_tasks
  public.maintenance_requests
  public.visitor_log
  public.audit_log            ← append-only, no RLS deletion policy
  public.notifications
  public.sync_log
  public.assets               ← asset register
  public.contractors
```

---

### 3.4 Tenant Onboarding Flow

```
1. Owner signs up at app.gh-hostels.com/register
   ↓
2. Supabase Auth creates user record
   ↓
3. Supabase Edge Function / API Route:
   - Creates row in public.tenants (slug auto-generated from hostel name)
   - Creates row in public.tenant_members (role: owner)
   - Creates row in public.tenant_config (default branding)
   - Provisions subdomain: {slug}.gh-hostels.com
   ↓
4. Owner completes onboarding wizard:
   - Upload logo
   - Set primary/secondary colours
   - Enter hostel details (name, address, GhanaPost GPS code, phone, email)
   - Configure room types and pricing
   ↓
5. [Optional] Owner adds custom domain (e.g., app.acaciahostel.com)
   → System calls Vercel Domains API to add domain
   → Owner shown CNAME record to add to their DNS
   → System polls until DNS verified → domain goes live
```

---

## PART 4 — WHITE-LABELING & CUSTOM DOMAIN SYSTEM

### 4.1 What Each Hostel Gets

Every hostel on GH Hostels is a completely independent branded experience:

```
HOSTEL IDENTITY ELEMENTS:
  ✓ Custom domain       app.acaciahostel.com (or acacia.gh-hostels.com)
  ✓ Custom logo         Shown in navbar, invoices, receipts, emails
  ✓ Custom favicon      Browser tab icon
  ✓ Brand colours       Primary + secondary — applied via CSS variables
  ✓ Hostel name         Shown everywhere (not "GH Hostels")
  ✓ Tagline             Optional short description
  ✓ Contact info        Address, phone, email — on invoices and portal
  ✓ Social links        Facebook, Instagram, WhatsApp number
  ✓ Invoice header      Full custom invoice with hostel letterhead
  ✓ Email templates     Transactional emails sent from hostel's email domain
  ✓ Occupant portal     Branded — students see their hostel's look and feel
  ✓ Booking page        Public-facing booking page in hostel branding
```

---

### 4.2 Custom Domain Implementation

```
STEP 1 — Owner enters domain in Settings → Domains
         e.g., "app.acaciahostel.com"

STEP 2 — GH Hostels backend calls Vercel Domains API:
         POST https://api.vercel.com/v10/projects/{projectId}/domains
         Body: { "name": "app.acaciahostel.com" }
         → Vercel returns: CNAME target "cname.vercel-dns.com"

STEP 3 — Owner is shown DNS instructions:
         "Add this CNAME record to your domain registrar:
          Name:  app
          Value: cname.vercel-dns.com"

STEP 4 — GH Hostels polls Vercel API every 30 seconds
         GET /v10/projects/{id}/domains/app.acaciahostel.com
         When verified: true → mark domain as active in tenant_config

STEP 5 — Vercel auto-provisions SSL (Let's Encrypt) → HTTPS live
         Owner notified via SMS + email: "Your custom domain is live!"

STEP 6 — Next.js Edge Middleware resolves tenant from hostname:
         "app.acaciahostel.com" → Upstash cache → tenant_id: "tid_0042"
```

**DNS Lookup Cache Strategy:**
```
Upstash Redis key: "domain:{hostname}"
Value: { tenant_id, slug, plan }
TTL: 1 hour (branding changes propagate within 1 hour)

On cache miss:
  → SELECT * FROM public.tenant_config WHERE custom_domain = {hostname}
     OR subdomain = {slug} (if using .gh-hostels.com subdomain)
  → Cache result for 1 hour
  → Return tenant context
```

---

### 4.3 Branding Configuration Schema

```sql
CREATE TABLE public.tenant_config (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID UNIQUE NOT NULL REFERENCES public.tenants(id),

    -- Identity
    hostel_name         VARCHAR(200) NOT NULL,
    tagline             VARCHAR(300),
    logo_url            TEXT,            -- Supabase Storage URL
    favicon_url         TEXT,
    cover_image_url     TEXT,            -- Hero image for booking page

    -- Branding
    primary_color       VARCHAR(7) DEFAULT '#1B4F72',   -- Hex
    secondary_color     VARCHAR(7) DEFAULT '#F39C12',
    font_family         VARCHAR(100) DEFAULT 'Inter',
    dark_mode_default   BOOLEAN DEFAULT false,

    -- Domain
    subdomain           VARCHAR(63) UNIQUE NOT NULL,    -- e.g., "acacia"
    custom_domain       VARCHAR(255) UNIQUE,            -- e.g., "app.acaciahostel.com"
    domain_verified     BOOLEAN DEFAULT false,
    domain_verified_at  TIMESTAMPTZ,

    -- Contact
    address             TEXT,
    gps_address         VARCHAR(20),                    -- GhanaPost GPS code
    phone_primary       VARCHAR(15),
    phone_secondary     VARCHAR(15),
    email               VARCHAR(254),
    whatsapp_number     VARCHAR(15),
    facebook_url        TEXT,
    instagram_url       TEXT,

    -- Business
    ghana_tin           VARCHAR(20),
    ghana_tax_office    VARCHAR(100),
    vat_registered      BOOLEAN DEFAULT false,
    vat_number          VARCHAR(20),
    currency            VARCHAR(3) DEFAULT 'GHS',
    timezone            VARCHAR(50) DEFAULT 'Africa/Accra',
    language            VARCHAR(10) DEFAULT 'en',

    -- Invoice customisation
    invoice_prefix      VARCHAR(10) DEFAULT 'INV',
    invoice_footer_text TEXT,
    bank_details        JSONB,          -- { bank, account_name, account_number, branch }

    -- Feature flags (controlled by subscription plan)
    features            JSONB DEFAULT '{}',

    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 4.4 Branding Delivery in Next.js

```typescript
// middleware.ts — runs at Vercel Edge before any page
export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? '';

  // Resolve tenant from hostname (Upstash Redis cache)
  const tenant = await resolveTenant(hostname);

  if (!tenant) {
    return NextResponse.redirect(new URL('/not-found', request.url));
  }

  // Inject tenant context into request headers
  const response = NextResponse.next();
  response.headers.set('x-tenant-id', tenant.id);
  response.headers.set('x-tenant-slug', tenant.slug);
  response.headers.set('x-tenant-plan', tenant.plan);
  return response;
}

// Root layout — fetches branding and applies CSS variables
// app/layout.tsx
export default async function RootLayout({ children }) {
  const tenantId = headers().get('x-tenant-id');
  const config = await getTenantConfig(tenantId); // cached in React cache()

  return (
    <html>
      <head>
        <title>{config.hostel_name}</title>
        <link rel="icon" href={config.favicon_url} />
      </head>
      <body style={{
        '--color-primary':   config.primary_color,
        '--color-secondary': config.secondary_color,
      } as React.CSSProperties}>
        <BrandingProvider config={config}>
          {children}
        </BrandingProvider>
      </body>
    </html>
  );
}
```

---

## PART 4B — PUBLIC WEBSITE INTEGRATION

Every hostel using GH Hostels already has a branded management app at their own domain
(e.g., `app.acaciahostel.com`). But their **public marketing website** — where prospective
occupants discover them — lives separately. This part defines how those two connect.

---

### 4B.1 The Three Hostel Scenarios

```
SCENARIO A — "I have an existing website"
  www.acaciahostel.com is on WordPress / Wix / Squarespace / Webflow / custom HTML
  Want: Visitors book directly without leaving the website
  Solution: JavaScript Embed Widget (paste one <script> tag)

SCENARIO B — "I have a domain but no website"
  acaciahostel.com exists but points nowhere useful
  Want: A professional online presence with live booking
  Solution: GH Hostels Hosted Booking Page becomes their website
            Point the root domain to app.acaciahostel.com

SCENARIO C — "I have a developer building my website"
  Custom website in progress or already built
  Want: Full programmatic control over how booking works
  Solution: Public REST API with API key authentication
```

All three are supported simultaneously. A hostel can use the hosted page AND embed the
widget on a separate marketing site AND give their developer API access.

---

### 4B.2 Domain Relationship Diagram

```
acaciahostel.com (root domain — owned by the hostel)
│
├── www.acaciahostel.com       ← Hostel's existing marketing website
│     (WordPress, Wix, etc.)    NOT managed by GH Hostels
│     │
│     └── Embeds <script> tag   ← GH Hostels Widget (hosted on our CDN)
│           ↓ API calls to ↓
│           api.gh-hostels.com/public/acacia/...
│
├── app.acaciahostel.com       ← GH Hostels management app + student portal
│     (CNAME → Vercel)           Fully managed by GH Hostels
│     │
│     ├── /dashboard             Staff & management
│     ├── /portal                Student self-service
│     └── /book                  Hosted public booking page (Scenario B)
│
└── book.acaciahostel.com      ← [Optional] Dedicated booking subdomain
      (CNAME → Vercel)           Points to app.acaciahostel.com/book
      Clean URL for "Book Now" buttons on marketing materials
```

---

### 4B.3 Approach 1 — Hosted Public Booking Page (Zero Work)

**Best for:** All hostels. This is the default — every hostel gets this automatically.

When a hostel signs up, GH Hostels automatically creates a fully public, SEO-optimised
booking page at `app.acaciahostel.com/book` (or `acacia.gh-hostels.com/book` if no custom
domain is configured yet).

**What the page contains:**
```
┌───────────────────────────────────────────────────┐
│  [HOSTEL LOGO]   ACACIA HOSTEL                    │
│  Premium Student Accommodation, Kumasi            │
├───────────────────────────────────────────────────┤
│  AVAILABLE ROOMS                                  │
│                                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐   │
│  │  Single    │  │  Double    │  │  Ensuite   │   │
│  │  GHS 600   │  │  GHS 450   │  │  GHS 800   │   │
│  │  /semester │  │  /semester │  │  /semester │   │
│  │  [Photo]   │  │  [Photo]   │  │  [Photo]   │   │
│  │  8 avail.  │  │  3 avail.  │  │  2 avail.  │   │
│  │ [Book Now] │  │ [Book Now] │  │ [Book Now] │   │
│  └────────────┘  └────────────┘  └────────────┘   │
├───────────────────────────────────────────────────┤
│  ABOUT US    AMENITIES    GALLERY    CONTACT       │
│  [Google Map — GhanaPost GPS]                      │
│  WhatsApp: +233 XX XXX XXXX                        │
└───────────────────────────────────────────────────┘
```

**Technical delivery:**
- Rendered as a Next.js static page (ISR — regenerates every 5 minutes)
- Fully branded: hostel logo, colours, name from `tenant_config`
- SEO meta tags: hostel name + city + "student accommodation" + room types
- Sitemap generated per tenant and submitted to Google
- No login required — completely public
- Mobile-first layout
- WhatsApp chat button (links to hostel's WhatsApp number)
- Share buttons (WhatsApp, Facebook — key sharing channels in Ghana)

**For Scenario B hostels (no website):**
The owner adds a CNAME for their root domain (`acaciahostel.com`) pointing to Vercel.
GH Hostels serves a full marketing landing page — effectively a website — that the
owner fills out via their settings: photos, about us text, amenities list, Google Map.
This means **GH Hostels doubles as a website builder for hostel owners who have no site**.

---

### 4B.4 Approach 2 — JavaScript Embed Widget (Recommended for Existing Websites)

**Best for:** Hostels with an existing website who want to keep visitors on their site.

**How it works from the hostel owner's perspective:**
```
1. Owner goes to Settings → Website Integration in their dashboard
2. Copies a 4-line snippet
3. Pastes it into their website (any platform)
4. Done. A booking form appears on their website.
```

**The snippet:**
```html
<!-- GH Hostels Booking Widget -->
<!-- Paste this anywhere in your website's HTML -->
<div id="gh-hostels-widget"></div>
<script
  src="https://cdn.gh-hostels.com/widget/v1/embed.js"
  data-tenant="acacia-hostel"
  data-key="pk_live_aXXXXXXXXXXXXXXXXXXXXXX"
  data-mode="inline"
  async>
</script>
```

**Widget display modes (owner chooses in settings):**

```
data-mode="inline"
  The booking form renders directly in the page where the <div> is placed.
  Ideal for a dedicated "Book a Room" page on their website.

data-mode="modal"
  Renders a "Book Now" button. Clicking it opens a full-screen modal overlay.
  Ideal for adding to any page without disrupting layout.

data-mode="floating"
  A sticky "Book Now" button fixed to the bottom-right corner of every page.
  Visitor can click it from anywhere on the website.
  Ideal for hostels who want passive booking conversion on all pages.
```

---

### 4B.5 Widget Technical Architecture

The widget is built as a **completely separate bundle** from the main Next.js application.
It must be small, self-contained, and safe to run on any third-party website.

```
cdn.gh-hostels.com/widget/v1/embed.js
  │
  ├── Size target: < 45KB gzipped (Preact instead of React for smaller bundle)
  ├── Zero external dependencies (no jQuery, no Bootstrap)
  ├── Self-scoped CSS (all styles prefixed .abr-widget-* to avoid conflicts)
  ├── No cookies set on the host website
  ├── No access to the host page's DOM outside its container div
  └── Communicates ONLY with api.gh-hostels.com (no third-party calls)

WIDGET BOOKING FLOW (5 steps):
  Step 1 — Room Type Selection
    → Fetches: GET /public/v1/{tenant}/rooms
    → Displays: photo, name, price, availability count, amenities list
    → User picks a room type and semester/duration

  Step 2 — Date & Duration
    → Semester picker (Semester 1 / Semester 2 / Long Vac) or custom dates
    → Shows exact price for selected duration

  Step 3 — Your Details
    → Fields: Full name, phone number, email (optional),
              student ID (optional), institution (optional)
    → Phone number is the primary identifier (Ghana-native)
    → OTP sent to phone to verify number before payment

  Step 4 — Payment
    → Paystack popup (handles MTN MoMo / Vodafone Cash / AirtelTigo / Card)
    → Deposit or full payment (configured by hostel)
    → Payment processed directly between occupant and hostel
    → GH Hostels never holds money (payment gateway direct settlement)

  Step 5 — Confirmation
    → Booking reference displayed (e.g., BK-2024-08421)
    → QR code for check-in
    → SMS confirmation sent to occupant's phone
    → WhatsApp message with booking details (if hostel has WhatsApp API)
    → Option to create portal account to track booking
```

**Widget build pipeline:**
```
packages/widget/
├── src/
│   ├── index.tsx          ← Entry: reads data-tenant, data-key, data-mode
│   ├── BookingFlow.tsx     ← Main multi-step flow component
│   ├── steps/
│   │   ├── RoomPicker.tsx
│   │   ├── DatePicker.tsx
│   │   ├── OccupantForm.tsx
│   │   ├── Payment.tsx
│   │   └── Confirmation.tsx
│   ├── api.ts             ← Typed API client (fetch only)
│   └── styles.css         ← Scoped CSS (all selectors: .abr-*)
├── build/
│   └── embed.js           ← Final bundle uploaded to Vercel CDN
└── package.json
    → build tool: Vite (fastest for library bundles)
    → framework: Preact (React-compatible, 3KB vs 45KB)
```

---

### 4B.6 Widget Security Design

The widget runs on the hostel's website — a domain we do not control. Security is critical.

```
PUBLIC API KEY (data-key="pk_live_xxx"):
  ✓ Scoped to public booking operations only
    (room availability, booking creation, payment initiation)
  ✗ Cannot access management data (occupant lists, invoices, staff records)
  ✗ Cannot read existing bookings (only create new ones)
  ✓ Safe to include in public HTML — by design
  ✓ Regeneratable in Settings → Website Integration if compromised

CORS PROTECTION:
  The public API only responds to requests from:
    1. The hostel's registered website domain(s)
    2. The GH Hostels app domain (app.acaciahostel.com)
    3. localhost:* (development)
  Any other origin receives a 403 Forbidden response.

  Owner registers allowed domains in Settings → Website Integration:
    ["https://www.acaciahostel.com", "https://acaciahostel.com"]
  These are stored in tenant_config.widget_allowed_origins (JSONB array).

RATE LIMITING (per tenant + per IP):
  Room availability lookups:  60 requests/minute
  Booking creation:           10 requests/minute per IP
  OTP requests:               3 per phone number per hour
  → Enforced at Edge Middleware layer (Upstash Redis counter)

PAYMENT SECURITY:
  GH Hostels never touches payment card data.
  Paystack handles all PCI-DSS compliance.
  The widget triggers Paystack's hosted popup — card details
  go directly from occupant browser to Paystack servers.

CSP HEADER NOTE:
  If the hostel's website has a Content Security Policy, they must add:
    script-src: https://cdn.gh-hostels.com
    connect-src: https://api.gh-hostels.com
  The widget settings page in the dashboard explains this with
  platform-specific instructions (WordPress, Wix, Squarespace).
```

---

### 4B.7 Approach 3 — Public REST API (For Developers)

**Best for:** Hostels whose website is being built by a developer who wants full control
over the UI and booking experience.

**API key type:** A separate `pk_api_` key with slightly more read access than the widget
key, but still restricted to the public booking scope.

```
BASE URL: https://api.gh-hostels.com/public/v1/{tenant-slug}/

AUTHENTICATION:
  Header: Authorization: Bearer pk_api_xxxxxxxxxxxxxxxx
  (public key — safe to use in frontend code)

ENDPOINTS:

  Room & Availability
  ────────────────────────────────────────────────────────────
  GET  /rooms
       List all room types with photos, pricing, amenities
       Response: [{ id, name, type, capacity, price, photos,
                    amenities, available_count }]

  GET  /rooms/availability
       Query: ?from=2024-08-01&to=2025-01-15&type=single
       Response: { available: true, count: 8, price: 600.00 }

  GET  /pricing
       Current pricing, promotions, and available discounts
       Response: { room_types: [...], promotions: [...] }

  Booking
  ────────────────────────────────────────────────────────────
  POST /bookings/check
       Body: { room_type_id, check_in, check_out }
       Response: { available: bool, price, breakdown }
       (Check before committing — used to show price summary)

  POST /bookings
       Body: { room_type_id, check_in, check_out, semester,
               occupant: { name, phone, email, student_id } }
       Response: { booking_ref, payment_ref, expires_at }
       (Creates a provisional booking — held for 15 minutes)

  POST /bookings/{ref}/verify-otp
       Body: { otp_code }
       (Confirms occupant's phone number before payment)

  POST /bookings/{ref}/pay
       Body: { method: "momo_mtn", phone: "0241234567" }
       Response: { payment_url, reference }
       (Initiates Paystack payment — redirect or popup)

  GET  /bookings/{ref}
       Public booking status for confirmation page
       Response: { ref, status, room_type, check_in, check_out,
                   amount_paid, qr_code_url }

  Hostel Info (for building a custom profile page)
  ────────────────────────────────────────────────────────────
  GET  /info
       Response: { name, tagline, address, gps_code, phone,
                   email, whatsapp, facebook, instagram,
                   photos: [...], amenities: [...] }

  Webhook (push updates to developer's server)
  ────────────────────────────────────────────────────────────
  POST /webhooks/subscribe
       Body: { url, events: ["booking.confirmed", "payment.received"] }
       (Developer's server receives POST when events occur)
```

**API response format (consistent across all endpoints):**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "tenant": "acacia-hostel",
    "timestamp": "2024-11-15T14:22:11Z",
    "request_id": "req_abc123"
  }
}
```

---

### 4B.8 Platform Integration Guides

The dashboard's "Website Integration" page provides platform-specific copy-paste
instructions. No developer knowledge required.

```
SUPPORTED PLATFORMS (Step-by-step guides in dashboard):

  WordPress
    → Paste widget snippet into Theme Editor → footer.php
    → OR use "Custom HTML" block in any page/post
    → OR install GH Hostels WordPress plugin (Phase 5 roadmap)

  Wix
    → Wix Editor → Add → Embed → Custom Code
    → Paste snippet, set to "Load once, on each page"

  Squarespace
    → Settings → Advanced → Code Injection → Footer
    → Paste snippet

  Webflow
    → Project Settings → Custom Code → Footer Code
    → Paste snippet

  Framer
    → Right-click → Insert → Embed
    → Paste snippet

  Custom HTML / Any other platform
    → Paste snippet anywhere between <body> tags

  No website (Scenario B)
    → Use the hosted booking page directly
    → Share the link: app.acaciahostel.com/book
    → Or point your domain root to GH Hostels
```

---

### 4B.9 Updated tenant_config Schema (additions for website integration)

The following fields are **added** to the existing `tenant_config` table:

```sql
ALTER TABLE public.tenant_config ADD COLUMN

    -- Website integration
    website_url             TEXT,                -- hostel's own website URL
    widget_api_key          VARCHAR(64),         -- public key for widget embed
    widget_api_key_prefix   VARCHAR(10),         -- e.g., "pk_live_"
    widget_allowed_origins  JSONB DEFAULT '[]',  -- CORS whitelist
    -- e.g., ["https://www.acaciahostel.com", "https://acaciahostel.com"]

    widget_mode_default     VARCHAR(20) DEFAULT 'inline',
    -- inline / modal / floating

    widget_primary_cta      VARCHAR(100) DEFAULT 'Book a Room',
    -- Customisable button text

    booking_page_enabled    BOOLEAN DEFAULT true,
    -- Toggle public booking page on/off

    booking_page_slug       VARCHAR(100),
    -- Custom URL slug: app.acaciahostel.com/{slug} (default: "book")

    booking_requires_deposit BOOLEAN DEFAULT true,
    deposit_percentage      NUMERIC(5,2) DEFAULT 30.00,
    -- 30% deposit required to confirm booking

    booking_hold_minutes    SMALLINT DEFAULT 15,
    -- How long a provisional booking is held before release

    -- SEO for hosted booking page
    seo_title               VARCHAR(200),
    seo_description         VARCHAR(400),
    seo_keywords            TEXT,

    -- Developer API access
    developer_api_key       VARCHAR(64),         -- pk_api_ prefixed key
    webhook_url             TEXT,
    webhook_events          JSONB DEFAULT '[]',
    webhook_secret          VARCHAR(64);         -- HMAC secret for verification
```

---

### 4B.10 Booking Widget Settings UI

In the management app under `Settings → Website Integration`, the owner sees:

```
┌──────────────────────────────────────────────────────────────────┐
│  WEBSITE INTEGRATION                                             │
├──────────────────────────────────────────────────────────────────┤
│  Your website URL: [https://www.acaciahostel.com        ] [Save] │
│                                                                  │
│  BOOKING PAGE                                                    │
│  Public URL: https://app.acaciahostel.com/book          [Copy]  │
│  Short URL:  https://acacia.gh-hostels.com/book          [Copy]  │
│  Status:     [● Live]   [Disable]                               │
│                                                                  │
│  EMBED WIDGET                                                    │
│  Display Mode: (●) Inline  ( ) Modal  ( ) Floating Button       │
│  Button Text:  [Book a Room                            ]         │
│  Allowed Domains:                                                │
│    [https://www.acaciahostel.com                    ] [Remove]  │
│    [https://acaciahostel.com                        ] [Remove]  │
│    [+ Add domain]                                                │
│                                                                  │
│  YOUR SNIPPET — paste into your website:                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ <div id="gh-hostels-widget"></div>                        │   │
│  │ <script                                                  │   │
│  │   src="https://cdn.gh-hostels.com/widget/v1/embed.js"    │   │
│  │   data-tenant="acacia-hostel"                           │   │
│  │   data-key="pk_live_aXXXXXXXX"                          │   │
│  │   data-mode="inline"                                     │   │
│  │   async>                                                 │   │
│  │ </script>                                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│  [Copy Snippet]  [Preview Widget]  [View Integration Guide]      │
│                                                                  │
│  PLATFORM GUIDES:                                                │
│  [WordPress] [Wix] [Squarespace] [Webflow] [Custom HTML]        │
│                                                                  │
│  DEVELOPER API                                                   │
│  API Key: pk_api_XXXX••••••••••••••••••    [Show] [Regenerate]  │
│  API Docs: https://docs.gh-hostels.com/api  [Open]               │
│  Webhook URL: [https://mysite.com/webhooks/hms      ]           │
└──────────────────────────────────────────────────────────────────┘
```

---

### 4B.11 Booking Flow Across the Three Approaches (Comparison)

```
                   Hosted Page    JS Widget     Public API
                   ───────────    ─────────     ──────────
Where user goes    New tab/page   Stays on site  Custom UI
                   (app.hostel)   (www.hostel)

Setup effort       None (auto)    Copy/paste     Developer needed

Branding           Full hostel    Full hostel    100% custom
                   branding       branding       (you control HTML)

Mobile UX          Optimised      Optimised      Up to developer

SEO benefit        Yes (hostel    Partial         Up to developer
                   page indexed)

MoMo payment       Paystack       Paystack        Paystack API
                   built-in       built-in        (you integrate)

Booking sync       Instant        Instant         Instant via API
to dashboard

SMS confirmation   Automatic      Automatic       API provides hook

Best for           All hostels    Has a website   Has a developer
                   (default)      already         building site
```

---

## PART 4C — AI-POWERED PREMIUM WEBSITE

### 4C.1 Overview

This is a premium add-on service within GH Hostels — not just a feature, but a
**product within the product**. It solves two real problems Ghanaian hostel owners face:

1. Their website (if they have one) is outdated, slow, and does not convert visitors into
   bookings. Many are built on free WordPress themes from 2015 with no mobile optimisation.
2. They miss bookings at night, on weekends, and during peak intake periods because no
   staff member is available to answer calls and questions from prospective occupants.

**What the AI-Powered Premium Website provides:**
```
PREMIUM WEBSITE:
  ✓ 4 professionally designed, mobile-first, high-converting templates
  ✓ Owner fills in content via guided CMS (no developer, no code)
  ✓ Hosted on hostel's own domain (www.acaciahostel.com)
  ✓ Live room availability pulled directly from GH Hostels data
  ✓ Integrated booking flow (widget built in, not embedded separately)
  ✓ SEO-optimised out of the box (hostel ranks on Google for "student hostel Kumasi")
  ✓ < 2s load time on 3G (performance-first build)

VOICE & CHAT AI AGENT:
  ✓ Floating chat/voice button on every page of the website
  ✓ Prospective occupants can type OR speak their questions
  ✓ AI answers using live hostel data (real availability, real pricing)
  ✓ AI can complete a full booking through conversation
  ✓ Available 24/7 — never misses a lead, even at midnight
  ✓ Dedicated phone number (someone can call and speak to the AI)
  ✓ Escalates to human when needed — sends SMS to manager
  ✓ Speaks Ghanaian English; understands Twi greetings and phrases
```

**Who this is for:**
```
IDEAL CUSTOMER A: Hostel with bad or no website
  → Gets a stunning, fast, professional website in 1 day
  → No developer needed — owner does it via the dashboard

IDEAL CUSTOMER B: Hostel missing bookings after hours
  → AI agent answers enquiries at 2am, on Sundays, during holidays
  → Never says "call us during working hours" again

IDEAL CUSTOMER C: Hostel owner who wants to look premium
  → Competes visually and technologically with the best hostels
  → "GH Hostels makes small hostels look like hotel chains"
```

---

### 4C.2 Premium Website Template System

Four templates are provided. Each is a complete, production-ready website built on the
same Next.js route structure but with distinct visual identities.

```
TEMPLATE 1 — "LUMINARY"
  Style:     Dark/dramatic, cinematic full-screen hero, gold/amber accents
  Best for:  Premium ensuite hostels, adult professionals, upmarket positioning
  Feel:      "This is the best hostel in Accra" — aspirational

TEMPLATE 2 — "CAMPUS"
  Style:     Clean white, sky blue/green, card-based, airy and modern
  Best for:  University student hostels, young demographic, approachable
  Feel:      "Home away from home" — friendly and inviting

TEMPLATE 3 — "VIBRANT"
  Style:     Bold colours pulled from tenant brand palette, energetic layout,
             Afrocentric design motifs, pattern accents
  Best for:  Hostels wanting a distinctly Ghanaian/African identity
  Feel:      "Proudly Ghanaian, modern and stylish"

TEMPLATE 4 — "PRESTIGE"
  Style:     Serif typography, sophisticated grid, muted tones, corporate elegance
  Best for:  Premium multi-room hostels, business travellers, high-end positioning
  Feel:      "Professional accommodation you can trust"
```

**Template page structure (same across all 4):**
```
/(website)/
  ├── /                 ← Home (hero, highlights, room preview, AI agent, CTA)
  ├── /rooms            ← All room types with photos, pricing, live availability
  ├── /rooms/[type]     ← Individual room type detail page
  ├── /about            ← Story, team photos, hostel photos, location
  ├── /gallery          ← Photo gallery (rooms, facilities, common areas)
  ├── /amenities        ← What the hostel offers (generator, WiFi, security, etc.)
  ├── /testimonials     ← Student reviews and ratings
  ├── /faq              ← Frequently asked questions (also feeds AI knowledge base)
  ├── /contact          ← Address, GhanaPost GPS map, phone, WhatsApp, form
  └── /book             ← Full booking flow (same as hosted booking page)
```

**Live availability on the website:**
Room listing pages show real-time availability pulled from GH Hostels data:
```
┌─────────────────────────────────────────────────────────┐
│  SINGLE ENSUITE ROOM                    GHS 800/semester │
│                                                         │
│  [Photo carousel]                                       │
│                                                         │
│  Private bathroom • Study desk • Wardrobe               │
│  24/7 security • Standby generator • WiFi               │
│                                                         │
│  ████████████████████░░  AVAILABILITY: 3 rooms left     │
│  Semester 1: Aug – Dec 2025                             │
│                                                         │
│  [  Book This Room  ]  [ Chat with AI ]                 │
└─────────────────────────────────────────────────────────┘
```

The scarcity indicator (`3 rooms left`) is live — it queries Supabase in real time via
an API call. This is a proven conversion driver.

---

### 4C.3 Content Management Interface

Owners edit their website content entirely within the GH Hostels dashboard.
No external tools, no code, no developer required.

```
Dashboard → Website → Content

SECTIONS (each can be toggled on/off):

  HERO
    Headline:         "Your Home in Kumasi Awaits"
    Subheadline:      "Premium student accommodation near KNUST"
    Hero image:       [Upload photo]
    CTA button text:  "Book Your Room"

  ABOUT US
    Title:            "About Acacia Hostel"
    Story text:       [Rich text editor — 3 paragraphs]
    Highlight stats:  [120 Rooms] [Est. 2018] [500+ Happy Students]
    About image:      [Upload photo]

  ROOMS PREVIEW
    → Auto-populated from room types in GH Hostels
    → Owner can reorder and choose which rooms to feature

  AMENITIES
    → Checklist of available amenities (owner ticks what applies):
      ✓ 24/7 Security Guard    ✓ Standby Generator
      ✓ Fast WiFi              ✓ Water Storage Tank
      ✓ CCTV Surveillance      ✓ Common Room / TV Area
      ✓ Laundry Service        ✓ On-site Maintenance
      ✓ Study Room             ✓ Visitor Parking

  GALLERY
    → Upload up to 20 photos (automatically optimised, WebP converted)
    → Drag to reorder

  TESTIMONIALS
    → Add student reviews: [Name] [Institution] [Year] [Quote] [Rating]
    → Option to pull from Google Reviews (Phase 5)

  FAQ
    → Add/edit questions and answers
    → These also feed the AI agent knowledge base automatically

  CONTACT
    → Auto-filled from tenant_config (address, phone, WhatsApp, email)
    → GhanaPost GPS code → embedded map via Google Maps / OpenStreetMap

  SEO SETTINGS
    → Page title, meta description, keywords
    → Auto-generated suggestion based on hostel name + location
```

**Website preview & publish flow:**
```
Edit content in dashboard
    │
    ▼
[Preview Website] → Opens live preview in new tab (using preview mode)
    │
    ▼
[Publish] → Triggers Vercel ISR revalidation (new content live in < 10 seconds)
    │
    ▼
[View Live Site] → Opens www.acaciahostel.com in new tab
```

---

### 4C.4 High-Conversion Design Principles

Every template is engineered around one goal: **turning website visitors into booked occupants**.
These are baked into the template design, not left for the hostel owner to figure out.

```
PRINCIPLE 1 — MOBILE FIRST, ALWAYS
  70%+ of Ghana web traffic is mobile.
  Hero CTA button is the first touchpoint on any screen size.
  All forms optimised for thumb-friendly input on Android.
  WhatsApp button always visible (single most trusted contact in Ghana).

PRINCIPLE 2 — SPEED IS CONVERSION
  Target: < 2 seconds on 3G.
  Images served via Vercel's CDN with Next.js Image (WebP, lazy load, blur-up).
  Critical CSS inlined. No render-blocking scripts.
  Fonts subset to only characters needed.
  Core Web Vitals: LCP < 2.5s, CLS < 0.1, FID < 100ms.

PRINCIPLE 3 — SCARCITY AND URGENCY
  "Only 3 rooms left for Semester 1" — shown in real time.
  "Semester 1 starts in 45 days" — countdown timer.
  "12 people viewed this room today" — social signal (calculated from analytics).
  These are honest (pulled from real data) — not fake countdown timers.

PRINCIPLE 4 — SOCIAL PROOF
  Student testimonials with name, institution, and year (relatable).
  "500+ students have lived here since 2018."
  If connected to Google Reviews (Phase 5): real ratings displayed.

PRINCIPLE 5 — TRUST SIGNALS
  "GRA-Compliant Invoices Issued" — serious hostel, not informal.
  "Payments via MTN MoMo / Vodafone Cash / Bank Transfer" — trusted channels.
  "24/7 Security" — addresses a real concern for students and parents.
  HTTPS padlock (Vercel SSL — automatic).

PRINCIPLE 6 — FRICTIONLESS PATH TO BOOKING
  One click from any page to the booking form.
  The AI agent can start the booking from a conversation.
  Phone number is sufficient — no mandatory email, no account required.
  MoMo payment in the same flow — not redirect to a bank website.

PRINCIPLE 7 — CLEAR PRICING, NO SURPRISES
  Full price breakdown shown before payment (rent + any levies).
  "What's included" list per room type.
  Deposit amount stated upfront ("GHS 200 deposit to confirm").
```

---

### 4C.5 Voice & Chat AI Agent — Overview

The AI agent is the most differentiated feature of the entire platform.

```
┌──────────────────────────────────────────────────────────────────┐
│                  AI AGENT INTERACTION POINTS                     │
│                                                                  │
│  WEBSITE BUTTON (all pages)                                      │
│  Floating button, bottom-right corner                            │
│  Shows: [🎤 Talk to Us]  or  [💬 Chat with Us]                   │
│  Desktop: Voice or Text (user chooses)                           │
│  Mobile: Defaults to Text (can switch to Voice)                  │
│                                                                  │
│  PHONE NUMBER                                                    │
│  Hostel gets a virtual number: +233 30 XXX XXXX                  │
│  Caller is greeted by AI in hostel's name                        │
│  Available 24/7 — AI answers immediately, no hold music          │
│  Transfer to human possible (AI sends SMS to manager)            │
│                                                                  │
│  WHATSAPP (Phase 5)                                              │
│  Same AI brain connected to WhatsApp Business API                │
│  Occupant messages on WhatsApp → AI responds instantly           │
└──────────────────────────────────────────────────────────────────┘
```

**A real conversation example (voice, 2am, prospective occupant):**
```
PROSPECTIVE OCCUPANT (calling in):
  "Hello, I want to ask about rooms for Semester 1."

AI (as Acacia Hostel):
  "Akwaaba! Good evening, you've reached Acacia Hostel. I'm Ama,
   the virtual assistant. I'm happy to help you.
   We have a few room types available for Semester 1 starting August.
   Are you looking for a single room or would you prefer to share?"

OCCUPANT:
  "Single room. How much is it?"

AI:
  "Our single ensuite rooms are GHS 800 per semester — that includes
   electricity, water, and 24/7 security. We currently have 3 of
   those left for Semester 1. Would you like to book one tonight?
   I can hold it for you right now."

OCCUPANT:
  "Yes please. My name is Kofi Asante."

AI:
  "Perfect, Kofi. Can I get your phone number to send you a
   confirmation and a booking reference?"

OCCUPANT:
  "0241234567."

AI:
  "I've sent a verification code to 0241234567.
   What's the code?"

OCCUPANT:
  "4-5-2-1."

AI:
  "Great, verified! To confirm your booking I'll need a GHS 200
   deposit via MoMo. Which network do you use — MTN, Vodafone,
   or AirtelTigo?"

OCCUPANT:
  "MTN."

AI:
  "I've sent a GHS 200 MoMo payment request to 0241234567.
   Please approve it on your phone and I'll confirm your
   booking immediately."

[Paystack processes payment]

AI:
  "Your booking is confirmed! Your reference is BK-2025-04821.
   I've sent the details to your phone by SMS. Welcome to Acacia
   Hostel, Kofi. Is there anything else I can help you with?"
```

This entire interaction happened at 2am with no staff involved.

---

### 4C.6 Voice & Chat AI Agent — Technical Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AI AGENT ARCHITECTURE                            │
│                                                                     │
│  INPUT CHANNELS                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  Web     │  │  Phone   │  │ WhatsApp │  │  Text    │            │
│  │  Voice   │  │  Call    │  │  (Ph5)   │  │  Chat    │            │
│  │ (WebRTC) │  │  (PSTN)  │  │          │  │          │            │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
│       │              │              │              │                 │
│       └──────────────┴──────────────┴──────┐       │                │
│                                            │       │                │
│  ┌─────────────────────────────────────────▼───────▼──────────────┐ │
│  │                      VAPI LAYER                                │ │
│  │  Speech-to-Text (STT)  ←── Voice input                        │ │
│  │  Text-to-Speech (TTS)  ──→ Voice output                       │ │
│  │  Phone call routing    ←── PSTN / VoIP                        │ │
│  │  WebRTC transport      ←── Browser voice                      │ │
│  │  Conversation state    ←── Multi-turn memory                  │ │
│  └─────────────────────────────────┬──────────────────────────────┘ │
│                                    │                                │
│  ┌─────────────────────────────────▼──────────────────────────────┐ │
│  │                    CLAUDE (LLM BRAIN)                          │ │
│  │                                                                │ │
│  │  System prompt = hostel context + agent persona                │ │
│  │  (fetched from Supabase at conversation start)                 │ │
│  │                                                                │ │
│  │  Tools available:                                              │ │
│  │  → check_availability()    → get_hostel_info()                 │ │
│  │  → get_room_details()      → create_booking()                  │ │
│  │  → get_pricing()           → send_otp()                        │ │
│  │  → verify_otp()            → initiate_payment()                │ │
│  │  → search_faqs()           → escalate_to_human()               │ │
│  └─────────────────────────────────┬──────────────────────────────┘ │
│                                    │  tool calls                    │
│  ┌─────────────────────────────────▼──────────────────────────────┐ │
│  │                   TOOL EXECUTION LAYER                         │ │
│  │    Next.js API Routes — called by Vapi when LLM uses a tool    │ │
│  │                                                                │ │
│  │  → Supabase (live availability, booking creation)              │ │
│  │  → Supabase pgvector (FAQ knowledge base search)               │ │
│  │  → Arkesel (OTP SMS)                                           │ │
│  │  → Paystack (MoMo payment initiation)                          │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

**Technology decisions:**

| Component | Choice | Reason |
|---|---|---|
| Voice infrastructure | **Vapi** | WebRTC + phone calls + STT/TTS built-in; designed exactly for this |
| LLM | **Claude Haiku 4.5** | Fast (< 1s response), cheap ($0.001/call), great instruction-following |
| STT (Speech-to-Text) | Vapi built-in (Deepgram) | Handles accented English well, real-time streaming |
| TTS (Text-to-Speech) | ElevenLabs via Vapi | High quality, natural Ghanaian English voice available |
| Knowledge base | **Supabase pgvector** | No extra service; vector search within existing Supabase project |
| Text chat UI | Vercel AI SDK streaming | Streaming responses, built for Next.js |
| Phone numbers | **Vapi phone numbers** | Virtual numbers, configurable per tenant |

---

### 4C.7 AI Agent Tool Functions

These are the functions Claude calls during a conversation to get real data.
Each tool is a Next.js API route protected by the Vapi webhook secret.

```typescript
// Tool: check_availability
// Called when occupant asks "Do you have any rooms for Semester 1?"
{
  name: "check_availability",
  description: "Check live room availability for given type and dates",
  parameters: {
    room_type:  "string | null",   // "single" | "double" | "ensuite" | null (all)
    semester:   "string | null",   // "SEM1_2025" | null
    check_in:   "date | null",
    check_out:  "date | null"
  },
  // Queries: SELECT COUNT(*) FROM rooms WHERE tenant_id=? AND status='available'
  // AND room_type LIKE ? ...
  returns: {
    available:    true,
    count:        3,
    room_types:   [{ type: "single_ensuite", count: 3, price: 800 }],
    next_semester: "Semester 1 starts 18 August 2025"
  }
}

// Tool: get_pricing
// Called when occupant asks "How much is a double room?"
{
  name: "get_pricing",
  description: "Get current pricing for all room types including active promotions",
  returns: {
    room_types: [
      { name: "Single Ensuite", semester_rate: 800, monthly_rate: 180 },
      { name: "Double Room",    semester_rate: 600, monthly_rate: 140 },
      { name: "Dormitory",      semester_rate: 400, monthly_rate: 100 }
    ],
    promotions: ["10% off if you book before 1st July"],
    deposit:    { percentage: 30, example_amount: 200 }
  }
}

// Tool: create_booking
// Called when occupant says "Yes, I want to book"
{
  name: "create_booking",
  description: "Create a provisional booking held for 15 minutes",
  parameters: {
    room_type_id: "uuid",
    check_in:     "date",
    check_out:    "date | null",
    semester:     "string | null",
    occupant: {
      full_name:  "string",
      phone:      "string",
      email:      "string | null",
      student_id: "string | null",
      institution:"string | null"
    }
  },
  returns: {
    booking_ref:  "BK-2025-04821",
    expires_at:   "2025-04-08T14:37:00Z",  // 15 min hold
    deposit_amount: 200,
    status:       "provisional"
  }
}

// Tool: send_otp
// Called to verify the occupant's phone number before payment
{
  name: "send_otp",
  parameters: { phone: "string" },
  // Sends 4-digit OTP via Arkesel SMS
  returns: { sent: true, expires_in_seconds: 300 }
}

// Tool: verify_otp
{
  name: "verify_otp",
  parameters: { phone: "string", code: "string" },
  returns: { verified: true }
}

// Tool: initiate_payment
// Called after OTP verified — triggers MoMo payment request
{
  name: "initiate_payment",
  parameters: {
    booking_ref: "string",
    method:      "momo_mtn | momo_vodafone | momo_airteltigo",
    phone:       "string",
    amount:      "number"
  },
  // Calls Paystack Mobile Money Charge API
  returns: {
    payment_ref:  "PAY_abc123",
    status:       "pending",  // Paystack sends push prompt to occupant's phone
    message:      "Payment prompt sent. Please approve on your phone."
  }
}

// Tool: search_faqs
// Called when occupant asks something not covered by other tools
// Uses Supabase pgvector to find the most relevant FAQ answer
{
  name: "search_faqs",
  parameters: { query: "string" },
  // Embeds query → vector search in tenant's FAQ table
  returns: {
    answer:     "Yes, we have a backup generator that runs during power cuts.",
    confidence: 0.92,
    source:     "Hostel FAQ"
  }
}

// Tool: escalate_to_human
// Called when AI cannot help: "I need to speak to a real person"
// or AI has tried 3 times and failed to resolve the query
{
  name: "escalate_to_human",
  parameters: {
    reason:       "string",
    contact_info: "string | null",  // occupant's phone if known
    summary:      "string"          // AI summarises the conversation
  },
  // Sends SMS to hostel manager:
  // "AI escalation from +233241234567: [summary]. Please call back."
  returns: { escalated: true }
}
```

---

### 4C.8 Per-Hostel AI Customisation

Every hostel's AI agent has its own identity. Owners configure this in their dashboard.

```
Dashboard → Website → AI Agent

  AGENT IDENTITY
    Agent name:      [Ama                          ]
    Greeting:        [Akwaaba! Welcome to Acacia Hostel. I'm Ama...]
    Personality:     (●) Friendly & Warm
                     ( ) Professional & Formal
                     ( ) Brief & Efficient

  LANGUAGE
    Primary:         (●) English  ( ) Twi  ( ) Both (switches on request)
    Accent style:    (●) Ghanaian English  ( ) Neutral English

  CAPABILITIES
    [✓] Answer questions about rooms and pricing
    [✓] Check live availability
    [✓] Create bookings through conversation
    [✓] Process MoMo payments
    [ ] Access student account information   ← disabled (privacy)
    [✓] Escalate to human if needed
    Escalate to:     [+233 24 XXX XXXX                    ] (manager phone)

  KNOWLEDGE BASE
    Custom FAQs (the AI learns from these):
    ┌──────────────────────────────────────────────────────┐
    │ Q: Do you have generator?                            │
    │ A: Yes, we have a 50KVA standby generator that...   │
    ├──────────────────────────────────────────────────────┤
    │ Q: Can I bring a visitor?                            │
    │ A: Visitors are allowed between 8am and 10pm...     │
    └──────────────────────────────────────────────────────┘
    [+ Add FAQ]

  PHONE NUMBER
    Your AI phone number: +233 30 XXX XXXX
    Status: [● Active]
    [Test Call]   [View Call Logs]

  WIDGET APPEARANCE
    Widget position: (●) Bottom Right  ( ) Bottom Left
    Button style:    (●) Talk / Chat   ( ) Chat only  ( ) Talk only
    Bubble color:    [ primary brand color auto-applied ]
    Show agent name: [✓] Show "Chat with Ama"
    Show avatar:     [✓] Upload agent avatar image
```

---

### 4C.9 AI Knowledge Base — Supabase pgvector

Each hostel has a dedicated vector knowledge base built from their FAQ entries,
room descriptions, hostel policies, and about-us content. When the AI receives a
question it cannot answer from its tools alone, it performs a semantic search.

```sql
-- Enable pgvector extension (Supabase supports this natively)
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge base table (tenant-scoped, RLS protected)
CREATE TABLE public.ai_knowledge_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id),
    category        VARCHAR(50),   -- 'faq' | 'policy' | 'room_info' | 'about'
    question        TEXT,          -- original question text
    answer          TEXT NOT NULL, -- the answer to embed and return
    embedding       vector(1536),  -- OpenAI text-embedding-3-small dimension
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast approximate nearest-neighbour search
CREATE INDEX ai_knowledge_embedding_idx
    ON public.ai_knowledge_entries
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- RLS policy
ALTER TABLE public.ai_knowledge_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.ai_knowledge_entries
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

**How embeddings are created:**
```
Owner saves/edits an FAQ in the dashboard
  → Trigger.dev job fires: embed_knowledge_entry
  → Calls OpenAI text-embedding-3-small API on the question + answer text
  → Stores the 1536-dimension vector in ai_knowledge_entries.embedding
  → Takes < 1 second, costs < $0.0001 per entry
```

**How the AI uses it:**
```
Occupant asks: "Do you have light when NEPA takes it?"
  → search_faqs tool called with query: "Do you have light when NEPA takes it?"
  → Query embedded via OpenAI
  → Supabase pgvector cosine similarity search → finds "Do you have generator?"
  → Returns answer: "Yes, we have a 50KVA standby generator..."
  → Claude incorporates this into a natural, conversational response
```

---

### 4C.10 Database Schema — New Tables

```sql
-- PREMIUM WEBSITE CONTENT
-- Stores all editable content for the premium website
CREATE TABLE public.tenant_website (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID UNIQUE NOT NULL REFERENCES public.tenants(id),
    template_id         VARCHAR(20) DEFAULT 'campus',
    -- luminary / campus / vibrant / prestige
    published           BOOLEAN DEFAULT false,
    published_at        TIMESTAMPTZ,
    last_edited_at      TIMESTAMPTZ,

    -- Hero section
    hero_headline       VARCHAR(200),
    hero_subheadline    VARCHAR(400),
    hero_image_url      TEXT,
    hero_cta_text       VARCHAR(50) DEFAULT 'Book Your Room',
    hero_show_availability BOOLEAN DEFAULT true,

    -- About section
    about_enabled       BOOLEAN DEFAULT true,
    about_title         VARCHAR(200),
    about_body          TEXT,             -- rich text (markdown)
    about_image_url     TEXT,
    about_stats         JSONB DEFAULT '[]',
    -- [{ label: "Rooms", value: "120" }, { label: "Est.", value: "2018" }]

    -- Amenities section
    amenities_enabled   BOOLEAN DEFAULT true,
    amenities           JSONB DEFAULT '[]',
    -- [{ icon: "generator", label: "Standby Generator", active: true }]

    -- Gallery section
    gallery_enabled     BOOLEAN DEFAULT true,
    gallery_images      JSONB DEFAULT '[]',
    -- [{ url: "...", caption: "Common room" }]

    -- Testimonials section
    testimonials_enabled BOOLEAN DEFAULT true,
    testimonials        JSONB DEFAULT '[]',
    -- [{ name, institution, year, quote, rating, photo_url }]

    -- Scarcity/urgency settings
    show_rooms_remaining BOOLEAN DEFAULT true,
    show_semester_countdown BOOLEAN DEFAULT true,

    -- SEO
    seo_title           VARCHAR(200),
    seo_description     VARCHAR(400),
    seo_keywords        TEXT,

    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- AI AGENT CONFIGURATION
CREATE TABLE public.tenant_ai_agent (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID UNIQUE NOT NULL REFERENCES public.tenants(id),
    enabled             BOOLEAN DEFAULT false,

    -- Identity
    agent_name          VARCHAR(50) DEFAULT 'Assistant',
    greeting_message    TEXT,
    personality         VARCHAR(20) DEFAULT 'friendly',
    -- friendly / professional / brief

    -- Language
    primary_language    VARCHAR(10) DEFAULT 'en',
    -- en / tw / en-tw (bilingual)
    accent_style        VARCHAR(20) DEFAULT 'ghanaian',

    -- Capabilities
    can_create_bookings  BOOLEAN DEFAULT true,
    can_process_payments BOOLEAN DEFAULT true,
    can_access_accounts  BOOLEAN DEFAULT false,

    -- Escalation
    escalation_phone    VARCHAR(15),
    escalation_triggers JSONB DEFAULT '[]',
    -- ["cant_answer_3x", "user_requests_human", "payment_failed"]

    -- Voice / Phone
    voice_enabled        BOOLEAN DEFAULT true,
    phone_number         VARCHAR(20),       -- Vapi phone number
    vapi_assistant_id    VARCHAR(100),      -- Vapi assistant UUID
    vapi_phone_id        VARCHAR(100),      -- Vapi phone number ID

    -- Widget appearance
    widget_position      VARCHAR(20) DEFAULT 'bottom_right',
    widget_style         VARCHAR(20) DEFAULT 'talk_and_chat',
    agent_avatar_url     TEXT,

    -- Analytics
    total_conversations  INTEGER DEFAULT 0,
    total_bookings_via_ai INTEGER DEFAULT 0,
    total_revenue_via_ai NUMERIC(12,2) DEFAULT 0,

    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 4C.11 Tech Stack Additions for AI Website

```
ADDITION             TECHNOLOGY           PURPOSE
──────────────────────────────────────────────────────────────────
Voice AI Platform    Vapi (vapi.ai)        WebRTC voice in browser,
                                           phone call routing,
                                           STT/TTS pipeline,
                                           Vapi SDK for web
LLM                  Claude Haiku 4.5      AI reasoning, conversation,
                     (Anthropic API)       tool call decisions
TTS Voice            ElevenLabs           High-quality Ghanaian English
                     (via Vapi)            voice synthesis
Knowledge Base       Supabase pgvector     Vector embeddings for FAQ/policy
                                           semantic search (no extra service)
Embeddings           OpenAI               text-embedding-3-small for
                     text-embedding-3-    FAQ vectorisation
                     small
Streaming Chat UI    Vercel AI SDK         Real-time streaming text responses
                                           for the chat interface
Website Build        Vite (widget bundle)  Same as booking widget —
                     (already in stack)    AI chat widget also bundled here
```

**Cost per conversation (AI agent):**
```
Voice conversation (3 min average):
  Vapi:        ~$0.15/min × 3 min  = $0.45
  Claude:      ~$0.001/call        = $0.001
  ElevenLabs:  included in Vapi    = $0.00
  Total:       ≈ $0.45 per voice call

Text conversation:
  Claude:      ~$0.002/conversation = $0.002
  Total:       ≈ $0.002 per text chat

Monthly cost for a busy hostel (100 voice + 200 text chats/month):
  100 × $0.45 + 200 × $0.002 = $45.40 + $0.40 = ~$46/month

This is included in the Enterprise plan.
Growth plan: capped at 50 voice calls/month (then pay-per-call).
```

---

### 4C.12 AI Website + Standard Website — How They Coexist

The premium website and the existing widget/booking-page system are not competing —
they stack on top of each other.

```
TIER A: No website integration
  Hostel uses GH Hostels for operations only.
  No public-facing web presence through GH Hostels.
  [Starter plan]

TIER B: Hosted booking page only
  GH Hostels provides a functional booking page at their domain.
  No marketing content, just book/availability.
  [Starter plan — free]

TIER C: JS Embed Widget
  Hostel embeds the booking widget on their existing website.
  [Growth plan]

TIER D: Premium Website
  GH Hostels provides the entire public-facing website.
  Full marketing site + integrated booking + live availability.
  No separate website needed.
  [Growth plan + Website add-on, or Enterprise]

TIER E: Premium Website + AI Agent
  Everything in Tier D plus:
  - Voice/chat AI agent on the website
  - AI phone number (24/7)
  - AI can book and process payment autonomously
  [Enterprise plan, or Growth + AI add-on]
```

---

## PART 5 — OFFLINE-FIRST PWA ARCHITECTURE

### 5.1 Offline Architecture Overview

```
BROWSER / DEVICE
┌────────────────────────────────────────────────────┐
│                                                    │
│  ┌──────────────┐     ┌──────────────────────────┐ │
│  │  React UI    │────▶│  TanStack Query          │ │
│  │  Components  │     │  (optimistic updates,    │ │
│  └──────────────┘     │   stale-while-revalidate)│ │
│                       └───────────┬──────────────┘ │
│                                   │                 │
│                       ┌───────────▼──────────────┐ │
│                       │  Dexie.js (IndexedDB)     │ │
│                       │  Local persistent store   │ │
│                       │  ┌──────────────────────┐ │ │
│                       │  │ rooms, occupants,    │ │ │
│                       │  │ bookings, invoices,  │ │ │
│                       │  │ tasks, transactions  │ │ │
│                       │  │ sync_queue, conflicts│ │ │
│                       │  └──────────────────────┘ │ │
│                       └───────────┬──────────────┘ │
│                                   │                 │
│  ┌──────────────────────────────────────────────┐  │
│  │           Service Worker (Workbox)           │  │
│  │  - Route interception                        │  │
│  │  - Cache strategies per resource type        │  │
│  │  - Background Sync API (retry queue)         │  │
│  │  - Push notification handler                 │  │
│  └────────────────────┬─────────────────────────┘  │
└───────────────────────┼────────────────────────────┘
                        │  (when online)
                        ▼
              Supabase + Next.js API Routes
```

### 5.2 Sync Engine Design

```
SYNC STRATEGY: CRDT-inspired Last-Write-Wins with client timestamps

Every record carries:
  - id           (UUID v7 — time-ordered, client-generated offline)
  - tenant_id    (from JWT, injected on creation)
  - updated_at   (server timestamp on sync confirmation)
  - updated_by   (user_id who made change)
  - client_id    (device/session identifier)
  - version      (monotonic counter per record)
  - deleted_at   (soft deletes only — never hard delete offline records)

SYNC QUEUE TABLE (IndexedDB):
  {
    id:          local UUID,
    entity:      "booking" | "invoice" | "task" | ...,
    operation:   "CREATE" | "UPDATE" | "DELETE",
    payload:     { ...full record },
    created_at:  local timestamp,
    retries:     0,
    status:      "pending" | "syncing" | "conflict" | "synced"
  }
```

**Sync Phases:**
1. **Push Phase** — Upload pending local queue to `/api/sync/push` in batches of 50
2. **Pull Phase** — Download server changes via Supabase `updated_at > last_sync_token`
3. **Reconcile Phase** — Apply server changes to IndexedDB, flag conflicts
4. **Acknowledge Phase** — Clear synced items from queue; update `last_sync_at`

**Conflict Resolution Matrix:**

| Conflict Type | Resolution Strategy |
|---|---|
| Same record edited by two users offline | Last `updated_at` wins + notify both users |
| Room booked twice while offline | First sync wins; second flagged for manual review |
| Payment recorded offline, already paid online | Flagged as duplicate; manager notified |
| Housekeeping task completed offline + re-assigned online | Merge: mark complete, log re-assignment |

### 5.3 Service Worker Cache Strategy

```
Resource Type             Cache Strategy            TTL
────────────────────────────────────────────────────────────
App shell (HTML/JS/CSS)   Cache-first               Until new version
Tenant branding / assets  Cache-first               24 hours
API: GET rooms/occupants  Stale-while-revalidate    5 min
API: GET dashboard data   Network-first             30 sec
API: POST/PUT/DELETE      Network-only + SW queue   N/A (queued offline)
Photos/avatars            Cache-first               7 days
PDFs (receipts, reports)  Network-only              N/A
```

---

## PART 6 — MODULE SPECIFICATIONS

### MODULE 01 — Dashboard & Owner Intelligence Hub

The owner's "control room." This is the centerpiece — built for paranoia-free ownership.

**Key Features:**
- **Live Occupancy Map** — Visual floor plan showing room status in real-time via Supabase Realtime
- **Revenue Pulse** — Today/Week/Month/Semester revenue vs target with trend sparklines
- **Activity Feed** — Chronological log of all significant events (check-ins, payments, complaints, staff actions)
- **Anomaly Alerts** — Flagged unusual patterns: a room marked vacant but electricity still running; a payment voided at 2am; invoice voids above threshold
- **Occupancy Rate KPIs** — Current, MTD, YTD with trend lines
- **Staff Activity Tracker** — Who is logged in, last action taken, last seen location
- **Cash Flow Forecast** — Projected income vs confirmed bookings for next 30/60/90 days
- **Maintenance Cost Tracker** — Running totals vs budget
- **Multi-Property View** — Owners with multiple hostels see a unified portfolio dashboard

---

### MODULE 02 — Occupant Management

```
Occupant Lifecycle:
  PROSPECT → APPLICANT → RESERVED → CHECKED_IN → CHECKED_OUT → ALUMNI
```

**Features:**
- Occupant onboarding with Ghana Card / Student ID capture (camera scan + OCR pre-fill)
- Profile: photo, contact, emergency contacts, institution, programme, year of study
- Room assignment with compatibility matching (gender, institution, preferences)
- Occupant self-service portal: view balance, raise maintenance requests, download receipts
- Batch import via CSV (start of semester — 200 students at once)
- Blacklist management (problematic former occupants — flagged on re-application)
- Full occupant history: rooms occupied, payments made, incidents
- Semester rollover wizard — auto-generate renewal offers to existing occupants
- WhatsApp / SMS communication per occupant or bulk broadcast

---

### MODULE 03 — Room & Property Management

**Features:**
- Room catalogue: number, type (single/double/ensuite/dormitory), floor, block, amenities
- Dynamic pricing per room type with seasonal/semester rules
- Room status workflow: `Available → Reserved → Occupied → Checkout-Pending → Cleaning → Inspected → Available`
- Room condition scoring (inspection checklist after each checkout)
- Utility tracking per room (electricity meter readings, water)
- Maintenance history per room
- Asset register per room (furniture, fittings — track damage claims against deposits)
- Floor plan builder (drag-and-drop visual room layout)
- QR code per room — scan to instantly pull up room profile and status

---

### MODULE 04 — Booking & Reservation Engine

**Features:**
- Online booking form (embeddable on hostel's own website — fully branded)
- Availability calendar with room type filters
- Waitlist management — auto-notify when room becomes available
- Booking hold timer (configurable — default 15 min to complete payment before release)
- Group bookings (sports team, church groups, corporate)
- Booking confirmation via SMS + WhatsApp
- Self-service check-in QR code (generated on booking confirmation)
- Booking source tracking: walk-in, online, agent, referral
- Cancellation policy enforcement with automated refund calculations
- Booking modification full audit trail

---

### MODULE 05 — Housekeeping Management

**Features:**
- Daily housekeeping schedule auto-generated from occupancy data
- Drag-and-drop staff task assignment board
- Task states: `Assigned → In Progress → Done → Inspected`
- Supervisor inspection checklist (room-by-room quality scoring with photos)
- Lost & Found register
- Linen inventory management (issue and return tracking)
- Cleaning supply consumption tracker
- Staff performance metrics (tasks completed, average time, quality scores)
- Urgent task escalation (manager alerted immediately)
- Photo evidence upload for room condition (before/after checkout)

---

### MODULE 06 — Invoicing & Billing

**Features:**
- Auto-invoice generation on booking confirmation
- Invoice templates in full hostel branding (logo, colours, address — GRA-compliant)
- Itemized billing: rent, utilities, laundry, penalties, extras
- Payment plan support (full payment / instalment schedules)
- Overdue reminders (auto SMS/WhatsApp at day 3, 7, 14 of overdue)
- Payment channels: MTN MoMo, Vodafone Cash, AirtelTigo, Bank Transfer, Cash
- Receipt generation (PDF, printable, shareable via WhatsApp)
- Credit note / refund management
- Prorated billing (mid-semester move-in/out)
- Bulk invoicing (generate invoices for all occupants at semester start)
- GRA-compliant tax fields: VAT (15%), NHIL (2.5%), GETFund (2.5%) where applicable
- Dispute flagging and resolution workflow

---

### MODULE 07 — Accounting & Financial Management

```
Chart of Accounts (Ghana-adapted):
  Revenue
    4000 - Rental Income
    4100 - Utility Surcharge Income
    4200 - Laundry Income
    4300 - Late Payment Penalties
    4400 - Damage Claim Income
  Expenses
    5000 - Staff Salaries & Wages
    5100 - Utilities (ECG / GWCL / PURC)
    5200 - Maintenance & Repairs
    5300 - Cleaning Supplies
    5400 - Admin & Office Expenses
    5500 - Security Services
    5600 - Waste Management
  Liability
    2000 - Security Deposits Held
    2100 - Advance Rent Received
    2200 - VAT Payable (GRA)
    2300 - PAYE Payable (GRA)
    2400 - SSNIT Contributions Payable
```

**Features:**
- Double-entry bookkeeping engine (auto journal entries from invoices, payments, payroll)
- Bank reconciliation (import bank statement CSV, auto-match transactions)
- Petty cash management with daily float tracking
- VAT returns preparation (GRA-compliant format)
- P&L statement, Balance Sheet, Cash Flow statement
- Expense claim workflow (staff submits → manager approves → accounts pays)
- Budget vs actual tracking per cost center
- Audit trail: every financial entry is immutable with full amendment log
- Export to Excel / PDF for external accountant sharing

---

### MODULE 08 — HR & Staff Management

**Features:**
- Staff profiles: personal, employment, Ghana Card, SSNIT, TIN
- Department & position hierarchy
- Contract management (start/end dates, salary, probation period)
- Attendance & shift management
  - Clock-in/out via the app (GPS-verified, checks within X metres of property)
  - Shift schedule builder (drag-and-drop weekly rota)
  - Late/absent flagging with manager alert
- Leave management (annual, sick, emergency, maternity/paternity)
  - Leave request → manager approve/reject workflow
  - Leave balance tracker per staff member
- Payroll processing
  - Gross to net: PAYE (GRA tax bands 2024), SSNIT (5.5% employee + 13% employer)
  - Payslip generation (PDF, delivered via email/WhatsApp)
  - Bank payment file export (Ghanaian interbank format)
- Performance appraisal forms (quarterly/bi-annual)
- Disciplinary record (written warnings, suspension log)
- Training & certification tracker
- Org chart visualisation

---

### MODULE 09 — Revenue Management

**Features:**
- Yield management: dynamic pricing suggestions based on live occupancy rate
  - < 60% occupancy → suggest promotional rate
  - > 85% occupancy → suggest premium rate
- Competitor rate benchmarking (manual input + comparison table)
- Promotion & discount engine (early booking, referral, loyalty programmes)
- Revenue per available room (RevPAR) calculation
- Semester revenue forecasting with scenario modelling
- Channel performance analysis (online vs walk-in vs agent vs institution)
- Revenue budget vs actual dashboards

---

### MODULE 10 — Maintenance & Asset Management

**Features:**
- Maintenance request portal (occupants raise via their portal, staff raise on-site)
- Work order lifecycle: `Raised → Prioritised → Assigned → In Progress → Resolved → Verified`
- Priority levels: Emergency / Urgent / Routine / Planned
- Contractor directory (external vendors: contact, rates, performance rating)
- Preventive maintenance schedules (recurring: generator service, plumbing checks, etc.)
- Asset register with QR code tagging
- Maintenance cost tracking per room/block
- SLA tracking (time-to-resolve by priority)
- Escalation: Emergency not actioned in 2hrs → SMS to owner directly

---

### MODULE 11 — Security & Access Control

**Features:**
- Visitor log (sign-in/out with Ghana Card scan or manual entry)
- Curfew management (alerts for after-curfew visitor sign-ins)
- Incident report system (fights, theft, fire, medical — severity logged)
- CCTV integration hooks (link to camera system dashboard URLs)
- Overnight visitor permits (manager-approved)
- Vehicle registration log for car park

---

### MODULE 12 — Communication Hub

**Features:**
- SMS broadcasts (via Arkesel / Hubtel gateway)
- WhatsApp Business API integration (broadcast + individual)
- In-app notification centre (Supabase Realtime push)
- Email campaigns (via Resend)
- Announcement board (visible on occupant portal)
- Complaint & feedback management (raise → logged → assigned → resolved)
- Anonymous suggestion box
- Communication history per occupant

---

### MODULE 13 — Reports & Analytics

**Features:**
- Pre-built reports: Daily Occupancy, Weekly Revenue, Monthly P&L, Overdue Rent,
  Housekeeping Performance, Staff Attendance, Maintenance Costs, Tax Liability (VAT/PAYE)
- Custom report builder (fields, filters, date ranges, grouping)
- Scheduled report delivery (PDF emailed at configured times)
- Data export: CSV, Excel, PDF
- Comparative analytics: this period vs last period vs same period last year

---

## PART 7 — ROLE-BASED ACCESS CONTROL & AUTH

### 7.1 Supabase Auth Integration

```
AUTH FLOW:
  1. User enters email + password (or magic link) at login
  2. Supabase Auth validates credentials
  3. PostgreSQL function hook enriches JWT with tenant_id + role claims
  4. Supabase returns signed JWT (access token 1hr + refresh token 7days)
  5. Client stores tokens in memory (access) + httpOnly cookie (refresh)
  6. All API calls include Authorization: Bearer {access_token}
  7. Supabase RLS reads auth.jwt() claims — no extra auth middleware needed

MFA:
  - TOTP (Google Authenticator) — Supabase Auth built-in — mandatory for owner/manager
  - SMS OTP fallback via Supabase Auth + Twilio/Arkesel

PASSWORD RECOVERY:
  - Magic link via email (primary)
  - SMS OTP (fallback — preferred in Ghana where email access is inconsistent)

SESSION MANAGEMENT:
  - Owner can see active sessions in Settings → Security
  - Owner can remotely revoke any session (via Supabase Auth admin API)
  - Suspicious session (new device/location) triggers SMS alert to owner
```

### 7.2 Role Hierarchy

```
PLATFORM LEVEL
└── super_admin          (GH Hostels platform operators — bypass RLS via service key)

TENANT LEVEL
├── owner                (all data visible, all financials, audit log, settings)
├── manager              (operations, approvals, staff management, no platform config)
├── accountant           (full financial module, read-only others, no staff pay details)
├── receptionist         (bookings, check-in/out, invoices — no accounting, no HR)
├── housekeeping_super   (assign & inspect cleaning tasks, view room statuses)
├── housekeeping_staff   (own task list only — simplified mobile UI)
├── maintenance_staff    (own work orders only — simplified mobile UI)
├── security_staff       (visitor log, incident reports, room statuses — read only)
├── hr_officer           (HR module full, payroll, no financial accounting module)
└── student/occupant     (self-service portal — own data only)
```

### 7.3 Permission Matrix

```
MODULE              owner  manager  acct.  recept. hk_sup  hk_staff  maint.  security  hr     student
────────────────────────────────────────────────────────────────────────────────────────────────────
Dashboard (full)      ✓      ✓        ✗       ✗      ✗        ✗        ✗       ✗        ✗       ✗
Dashboard (ops)       -      -        ✓       ✓      ✓        ✗        ✗       ✗        ✓       ✗
Occupant: view        ✓      ✓        ✓       ✓      ✗        ✗        ✗       ✗        ✓       own
Occupant: edit        ✓      ✓        ✗       ✓      ✗        ✗        ✗       ✗        ✗       ✗
Rooms: view           ✓      ✓        ✓       ✓      ✓        ✓        ✓       ✗        ✗       own
Rooms: edit           ✓      ✓        ✗       ✗      ✗        ✗        ✗       ✗        ✗       ✗
Booking: view         ✓      ✓        ✓       ✓      ✗        ✗        ✗       ✗        ✗       own
Booking: create/edit  ✓      ✓        ✗       ✓      ✗        ✗        ✗       ✗        ✗       ✗
Housekeeping          ✓      ✓        ✗       ✗      ✓        own      ✗       ✗        ✗       ✗
Invoices: view        ✓      ✓        ✓       ✓      ✗        ✗        ✗       ✗        ✗       own
Invoices: create      ✓      ✓        ✓       ✓      ✗        ✗        ✗       ✗        ✗       ✗
Accounting            ✓      ✓        ✓       ✗      ✗        ✗        ✗       ✗        ✗       ✗
HR: staff view        ✓      ✓        ✗       ✗      ✗        ✗        ✗       ✗        ✓       ✗
HR: payroll           ✓      ✗        ✓       ✗      ✗        ✗        ✗       ✗        ✓       ✗
Revenue mgmt          ✓      ✓        ✓       ✗      ✗        ✗        ✗       ✗        ✗       ✗
Maintenance           ✓      ✓        ✗       ✗      ✗        ✗        own     ✗        ✗       raise
Security/Visitors     ✓      ✓        ✗       ✗      ✗        ✗        ✗       ✓        ✗       ✗
Reports (financial)   ✓      ✓        ✓       ✗      ✗        ✗        ✗       ✗        ✗       ✗
Reports (ops)         ✓      ✓        ✓       ✓      ✓        ✗        ✗       ✗        ✓       ✗
Staff management      ✓      ✓        ✗       ✗      ✗        ✗        ✗       ✗        ✓       ✗
Audit log             ✓      ✗        ✗       ✗      ✗        ✗        ✗       ✗        ✗       ✗
Tenant settings       ✓      ✓        ✗       ✗      ✗        ✗        ✗       ✗        ✗       ✗
Branding / Domain     ✓      ✗        ✗       ✗      ✗        ✗        ✗       ✗        ✗       ✗
```

---

## PART 8 — DATA MODEL DESIGN

### 8.1 Core Entity Relationships

```sql
-- PLATFORM TABLES (no tenant_id, no RLS)
-- ─────────────────────────────────────────

CREATE TABLE public.tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(63) UNIQUE NOT NULL,   -- e.g. "acacia-hostel"
    name            VARCHAR(200) NOT NULL,
    plan            VARCHAR(20) DEFAULT 'starter', -- starter/growth/enterprise
    status          VARCHAR(20) DEFAULT 'active',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.tenant_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id),
    user_id         UUID NOT NULL REFERENCES auth.users(id),
    role            VARCHAR(30) NOT NULL,
    staff_id        UUID,                           -- links to staff table
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

-- TENANT-SCOPED TABLES (all have tenant_id + RLS)
-- ──────────────────────────────────────────────────

CREATE TABLE public.rooms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id),
    property_id     UUID NOT NULL,
    room_number     VARCHAR(20) NOT NULL,
    block           VARCHAR(20),
    floor           SMALLINT,
    room_type_id    UUID NOT NULL,
    capacity        SMALLINT NOT NULL DEFAULT 1,
    status          VARCHAR(30) NOT NULL DEFAULT 'available',
    -- status enum: available/reserved/occupied/checkout_pending/cleaning/maintenance
    gender_policy   VARCHAR(10) DEFAULT 'any',
    monthly_rate    NUMERIC(10,2) NOT NULL,
    semester_rate   NUMERIC(10,2),
    daily_rate      NUMERIC(10,2),
    amenities       JSONB DEFAULT '[]',
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.occupants (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id),
    user_id             UUID REFERENCES auth.users(id),  -- if they have portal access
    full_name           VARCHAR(200) NOT NULL,
    ghana_card_number   TEXT,                             -- encrypted via pgcrypto
    student_id          VARCHAR(50),
    institution         VARCHAR(200),
    programme           VARCHAR(200),
    year_of_study       SMALLINT,
    date_of_birth       DATE,
    gender              VARCHAR(10),
    phone_primary       VARCHAR(15) NOT NULL,
    phone_secondary     VARCHAR(15),
    email               VARCHAR(254),
    photo_url           TEXT,                             -- Supabase Storage
    id_document_url     TEXT,
    emergency_contact   JSONB,
    -- { name, relationship, phone, address }
    status              VARCHAR(20) DEFAULT 'active',
    blacklisted         BOOLEAN DEFAULT false,
    blacklist_reason    TEXT,
    notes               TEXT,
    created_by          UUID NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.bookings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id),
    booking_ref     VARCHAR(20) UNIQUE NOT NULL,          -- BK-2024-08421
    occupant_id     UUID NOT NULL REFERENCES public.occupants(id),
    room_id         UUID NOT NULL REFERENCES public.rooms(id),
    check_in_date   DATE NOT NULL,
    check_out_date  DATE,
    booking_type    VARCHAR(20) NOT NULL,                 -- semester/monthly/daily
    semester        VARCHAR(10),                          -- "SEM1_2024"
    status          VARCHAR(30) NOT NULL DEFAULT 'confirmed',
    source          VARCHAR(30),                          -- walk_in/online/agent
    deposit_amount  NUMERIC(10,2) DEFAULT 0,
    deposit_status  VARCHAR(20) DEFAULT 'pending',
    notes           TEXT,
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    -- Database-level double-booking prevention
    EXCLUDE USING gist (
        room_id WITH =,
        daterange(check_in_date, COALESCE(check_out_date, 'infinity'), '[)') WITH &&
    ) WHERE (status NOT IN ('cancelled', 'no_show'))
);

CREATE TABLE public.invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id),
    invoice_number  VARCHAR(30) UNIQUE NOT NULL,          -- HMS-2024-00001
    occupant_id     UUID NOT NULL REFERENCES public.occupants(id),
    booking_id      UUID REFERENCES public.bookings(id),
    issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date        DATE NOT NULL,
    status          VARCHAR(20) DEFAULT 'unpaid',
    -- status: draft/unpaid/partially_paid/paid/overdue/void
    subtotal        NUMERIC(12,2) NOT NULL,
    vat_rate        NUMERIC(5,4) DEFAULT 0,
    vat_amount      NUMERIC(12,2) DEFAULT 0,
    nhil_amount     NUMERIC(12,2) DEFAULT 0,
    getfund_amount  NUMERIC(12,2) DEFAULT 0,
    total_amount    NUMERIC(12,2) NOT NULL,
    amount_paid     NUMERIC(12,2) DEFAULT 0,
    currency        VARCHAR(3) DEFAULT 'GHS',
    notes           TEXT,
    void_reason     TEXT,
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id),
    invoice_id          UUID NOT NULL REFERENCES public.invoices(id),
    occupant_id         UUID NOT NULL REFERENCES public.occupants(id),
    amount              NUMERIC(12,2) NOT NULL,
    method              VARCHAR(30) NOT NULL,
    -- momo_mtn/momo_vodafone/momo_airteltigo/bank_transfer/cash
    reference           VARCHAR(100),                     -- bank/MoMo reference
    momo_transaction_id VARCHAR(100),
    paid_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_by         UUID NOT NULL,
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- AUDIT LOG (append-only — RLS prevents all deletes/updates)
CREATE TABLE public.audit_log (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    actor_id        UUID,
    actor_name      VARCHAR(200),
    actor_role      VARCHAR(30),
    action          VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(50),
    entity_id       UUID,
    description     TEXT,
    old_values      JSONB,
    new_values      JSONB,
    ip_address      TEXT,
    user_agent      TEXT,
    device_id       VARCHAR(100),
    occurred_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent all modifications to audit_log
CREATE POLICY "audit_log_insert_only" ON public.audit_log
    FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
-- No UPDATE or DELETE policy created — these operations will be denied
```

---

## PART 9 — TECHNOLOGY STACK

### 9.1 Full Stack — Startup-Optimised

```
LAYER               TECHNOLOGY               REPLACES / RATIONALE
─────────────────────────────────────────────────────────────────────
Frontend            Next.js 14 (App Router)  SSR, Edge Middleware, API Routes
                    TypeScript               End-to-end type safety
UI                  shadcn/ui + Tailwind CSS  Fully brandable, accessible
State               Zustand + TanStack Query  Lightweight; TQ handles offline cache
Local DB            Dexie.js (IndexedDB)      Offline store with typed queries
Service Worker      Workbox                   PWA caching + background sync
Charts              Recharts                  Lightweight, composable
Forms               React Hook Form + Zod     Type-safe validation
Tables              TanStack Table            Virtualized, sortable, filterable
PDF                 React-PDF                 Offline invoice/receipt generation
QR Codes            qrcode.react             Room QR codes, check-in codes
i18n                next-intl                SSR-compatible, Twi support
─────────────────────────────────────────────────────────────────────
Database            Supabase PostgreSQL       Replaces: self-hosted PostgreSQL
                    (managed, auto-backups,   Bonus: Studio UI, auto REST API,
                     auto scaling)            daily backups, PITR on Pro
Auth                Supabase Auth             Replaces: Passport.js + NextAuth
                    (JWT, MFA, magic link,    Bonus: pre-built UI, session mgmt,
                     SMS OTP, OAuth)          social logins, MFA built-in
Storage             Supabase Storage          Replaces: S3 / Cloudflare R2
                    (CDN-backed, RLS on       Bonus: same security model as DB
                     buckets)
Realtime            Supabase Realtime         Replaces: Socket.io
                    (PostgreSQL CDC,          Bonus: no separate server needed,
                     presence, broadcast)     owner dashboard live updates
API                 Next.js API Routes        Replaces: separate NestJS server
                    (on Vercel — serverless)  (start here; extract to Railway
                                              when business logic is heavy)
─────────────────────────────────────────────────────────────────────
Cache               Upstash Redis             Replaces: self-hosted Redis
                    (serverless, free tier)   Used for: tenant resolution cache,
                                              rate limiting, session store
Background Jobs     Trigger.dev               Replaces: BullMQ + Redis worker
                    (serverless, free tier)   Used for: SMS dispatch, invoice
                                              PDF generation, report scheduling,
                                              sync processing, anomaly detection
─────────────────────────────────────────────────────────────────────
Hosting             Vercel (Frontend + API)   See Part 2 for full rationale
DNS/CDN             Cloudflare (free tier)    DDoS, asset caching, DNS
─────────────────────────────────────────────────────────────────────
Error Tracking      Sentry (free tier)        Real-time error alerts
Analytics           Vercel Analytics          Page performance + Web Vitals
                    (built-in)
─────────────────────────────────────────────────────────────────────
```

### 9.2 Ghanaian Integrations

```
INTEGRATION          PROVIDER              PURPOSE
──────────────────────────────────────────────────────────────────
Mobile Money         Paystack               MTN MoMo, Vodafone Cash,
                     (preferred)            AirtelTigo — best Ghana coverage,
                                           excellent developer experience
Mobile Money (alt)   Hubtel                 Direct MoMo APIs, more control
SMS Gateway          Arkesel                Best Ghana delivery rates,
                                           Unicode (Twi characters), OTP
WhatsApp Business    Meta Cloud API         Booking confirmations, receipts,
                     (via Arkesel or        payment reminders
                      360dialog)
Email                Resend                 Transactional: invoices, reports,
                                           welcome emails
GhanaPostGPS         GhanaPostGPS API       Digital address validation for
                                           hostel and occupant addresses
GRA                  Manual export (PDF)    VAT filing — GRA's e-VAT portal
                                           requires manual upload currently;
                                           integrate via API when available
Bank Payroll         GH-INTER format        Payslip bank transfer file export
```

### 9.3 Project Structure

```
gh-hostels/
├── apps/
│   └── web/                              # Next.js 14 (frontend + API)
│       ├── app/
│       │   ├── (auth)/                   # Login, register, forgot password
│       │   ├── (tenant)/                 # All authenticated tenant pages
│       │   │   ├── dashboard/
│       │   │   ├── occupants/
│       │   │   ├── rooms/
│       │   │   ├── bookings/
│       │   │   ├── housekeeping/
│       │   │   ├── invoices/
│       │   │   ├── accounting/
│       │   │   ├── hr/
│       │   │   ├── maintenance/
│       │   │   ├── security/
│       │   │   ├── reports/
│       │   │   └── settings/
│       │   │       └── branding/         # Logo, colours, domain config
│       │   ├── (portal)/                 # Student self-service portal
│       │   ├── (booking)/                # Public booking page (per tenant branding)
│       │   └── api/                      # Next.js API Routes
│       │       ├── auth/                 # Auth callbacks
│       │       ├── sync/                 # Offline sync endpoints
│       │       ├── webhooks/             # MoMo callbacks, Trigger.dev
│       │       └── domains/              # Vercel domain management
│       ├── components/
│       │   ├── ui/                       # shadcn base components
│       │   ├── modules/                  # Feature-specific components
│       │   └── branding/                 # Logo, ThemeProvider, TenantHead
│       ├── lib/
│       │   ├── supabase/                 # Supabase client (server + browser)
│       │   ├── db/                       # Dexie.js schema + hooks
│       │   ├── sync/                     # Offline sync engine
│       │   └── tenant/                   # Tenant resolution utilities
│       ├── middleware.ts                  # Edge middleware (tenant resolution)
│       └── public/
│           ├── sw.js                     # Service worker
│           └── manifest.json             # PWA manifest
│
├── supabase/
│   ├── migrations/                       # SQL migration files
│   ├── functions/                        # Supabase Edge Functions
│   │   ├── custom-jwt-claims/            # JWT enrichment hook
│   │   ├── on-tenant-created/            # Post-signup provisioning
│   │   └── anomaly-detector/            # Scheduled anomaly checks
│   └── seed.sql                          # Dev seed data
│
├── trigger/                              # Trigger.dev job definitions
│   ├── sms-dispatcher.ts
│   ├── invoice-generator.ts
│   ├── report-scheduler.ts
│   └── sync-processor.ts
│
└── packages/
    ├── types/                            # Shared TypeScript types
    └── ui/                               # Design tokens, Tailwind config
```

---

## PART 10 — STARTUP COST BREAKDOWN

### 10.1 Month 1–6 (MVP / Early Customers)

```
SERVICE                FREE TIER LIMIT         MONTHLY COST
──────────────────────────────────────────────────────────────
Vercel (Hobby)         100GB bandwidth          $0
                       100 deploys/day
                       Edge Middleware
                       Serverless functions
                       Custom domains (via API)

Supabase (Free)        500MB database           $0
                       50,000 monthly active users
                       1GB file storage
                       2GB realtime bandwidth
                       500MB Edge Function calls

Upstash Redis (Free)   10,000 commands/day      $0
                       256MB data

Trigger.dev (Free)     5,000 job runs/month     $0

Sentry (Free)          5,000 errors/month       $0

Cloudflare (Free)      Unlimited bandwidth      $0
                       DNS management

Arkesel SMS            Pay-as-you-go            ~GHS 0.04/SMS
                       (100 SMS ≈ GHS 4)

Resend (Free)          3,000 emails/month       $0

Paystack               1.5% + GHS 0.50/txn      Transaction fee only
                       (no monthly fee)

GITHUB                 Unlimited public repos   $0
                       (private: free for 3+)
──────────────────────────────────────────────────────────────
TOTAL FIXED COST:                               ~$0/month
(pay only for SMS and Paystack transaction fees)
```

### 10.2 When You Need to Upgrade

```
TRIGGER                          UPGRADE TO              NEW COST
────────────────────────────────────────────────────────────────
> 500MB database storage         Supabase Pro            $25/mo
> 50K monthly active users       Supabase Pro            $25/mo
> 10K Redis commands/day         Upstash Pay-as-you-go   ~$10/mo
> 100GB Vercel bandwidth         Vercel Pro              $20/mo
> 5K Trigger.dev job runs/mo     Trigger.dev Hobby       $20/mo
Complex business logic needed    Railway (NestJS API)    $5/mo

REALISTIC YEAR 1 CEILING:                               ~$80/mo
(10 hostels, ~500 active users, moderate SMS volume)
```

### 10.3 Supabase Free Tier — What It Covers

The Supabase free tier is generous enough to run a real product:
- **500MB database** — sufficient for ~10 hostels with full data
- **50,000 MAU** — more than enough for year 1
- **1GB storage** — logos, receipts, photos (compress images aggressively)
- **Realtime** — owner live dashboard works on free tier
- **Auth** — unlimited auth events on free tier
- **Edge Functions** — 500,000 invocations/month free

**One important note on Supabase free tier:** Projects that are inactive for 7 days are
paused. To avoid this, enable the "No pause" setting (available on Pro) OR ensure at least
one active user every 7 days (easy when you have real customers).

---

## PART 11 — UX DESIGN PHILOSOPHY

### 11.1 Adaptive Interface by Role

```
OWNER VIEW:          "The Control Room"
  → Information-dense dashboards, financial summaries, anomaly alerts
  → Their hostel brand — logo, colours — not GH Hostels branding
  → Real-time live feed via Supabase Realtime

MANAGER VIEW:        "The Operations Desk"
  → Task-oriented: Today's checklist, pending approvals, overdue items
  → Quick-action buttons: Check in, Assign room, Record payment

RECEPTIONIST VIEW:   "The Front Desk"
  → Booking search front-and-centre
  → Room availability grid at a glance
  → Fast MoMo payment recording flow (3 taps)

HOUSEKEEPING VIEW:   "The Task Board"
  → Ultra-simplified: their task list, room number, task type, photos
  → Large touch targets (gloves, large hands)
  → Works completely offline — syncs automatically when WiFi found
  → Multilingual: English / Twi toggle

STUDENT PORTAL:      "My Hostel"
  → Hostel branding (logo, colours) — not a generic app
  → Balance, receipt download, maintenance request, announcements
  → Pay via MoMo directly from portal
```

### 11.2 Performance Budget (Ghana Network Realities)

```
Target (3G connection, mid-range Android):
  Time to Interactive:          < 3.5 seconds
  First Contentful Paint:       < 1.5 seconds
  Bundle Size (initial JS):     < 150kb gzipped
  Offline functionality:        100% of core workflows

Tactics:
  - Code splitting per route and role (staff never loads accounting JS)
  - Next.js Image: WebP/AVIF, lazy load, blur placeholders
  - Tenant branding CSS variables: single CSS file, no runtime JS
  - Font subsetting (Latin + Twi characters only)
  - Brotli compression on Vercel (automatic)
  - IndexedDB pre-population on first login (background sync of core data)
```

---

## PART 12 — OWNER INTELLIGENCE: THE "EYE & EAR" FEATURES

### 12.1 The Owner Surveillance Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│  [HOSTEL LOGO]  ACACIA HOSTEL — LIVE              12:47 PM      │
├──────────────┬──────────────┬──────────────┬───────────────────┤
│ OCCUPANCY    │  TODAY'S REV │  OVERDUE     │  ACTIVE STAFF     │
│  47/50       │  GHS 3,200   │  GHS 8,400   │  12 logged in     │
│  94%         │  up 12% LW   │  6 occupants │  2 on leave       │
├──────────────┴──────────────┴──────────────┴───────────────────┤
│  LIVE ACTIVITY FEED (Supabase Realtime)                         │
│  12:46 PM  Kofi Mensah checked in to Room 204  [Receptionist]  │
│  12:44 PM  Invoice #HMS-2024-0341 paid — GHS 850 via MoMo      │
│  12:41 PM  Room 108 reported: broken ceiling fan [URGENT]      │
│  12:38 PM  Staff Akosua clocked in (12 mins late)              │
│  12:30 PM  New booking: Ama Asante → Room 301, Sem 2 2024      │
├─────────────────────────────────────────────────────────────────┤
│  ANOMALY ALERTS              2 alerts requiring your attention  │
│  Room 205 marked vacant 3 days ago — electricity still running  │
│  3 invoices voided by Receptionist John in last 2 hours        │
└─────────────────────────────────────────────────────────────────┘
```

**Live Feed powered by Supabase Realtime:**
```typescript
// Owner dashboard subscribes to audit_log changes
const channel = supabase
  .channel('owner-feed')
  .on('postgres_changes', {
    event:  'INSERT',
    schema: 'public',
    table:  'audit_log',
    filter: `tenant_id=eq.${tenantId}`,
  }, (payload) => {
    addToActivityFeed(payload.new);
    checkAnomalyRules(payload.new);
  })
  .subscribe();
```

### 12.2 Anomaly Detection Rules Engine

| Anomaly | Trigger | Alert Channel |
|---|---|---|
| Late-night staff logins | Any staff login between 11pm–5am | SMS to owner immediately |
| Bulk deletions | > 5 records deleted in 10 minutes | SMS + suspend account |
| Invoice void spike | > 2 invoice voids in one shift | Push notification |
| Cash discrepancy | Cash recorded != invoices paid | Dashboard alert |
| Vacant room utility anomaly | Room vacant 3+ days, electricity meter rising | Daily digest |
| Occupant without active booking | Room occupant record, no active booking | Immediate alert |
| GPS clock-in anomaly | Staff clock-in > 500m from property | Push notification |
| Stale reservation | Confirmed booking, no payment attempt in 48hrs | SMS reminder + owner alert |

Anomaly rules are stored in the database and evaluated by a Trigger.dev scheduled job
every 15 minutes — no hard-coded logic, rules can be adjusted without deployment.

### 12.3 Immutable Audit Trail

Every write operation produces an audit record. The RLS policy for `audit_log` permits
only INSERT (no UPDATE, no DELETE). Even the database owner cannot alter historical records.

```json
{
  "id": 84721,
  "occurred_at": "2024-11-15T14:22:11.000Z",
  "actor_name": "John Kwame",
  "actor_role": "receptionist",
  "action": "UPDATE",
  "entity_type": "invoice",
  "description": "Invoice HMS-2024-0341 status changed to VOIDED",
  "old_values": { "status": "sent", "total_amount": 850.00 },
  "new_values": { "status": "voided", "void_reason": "duplicate" },
  "ip_address": "154.160.x.x",
  "user_agent": "Chrome 119 / Android"
}
```

Owner receives a **Daily Audit Digest** at 7am every morning via email — generated by a
Trigger.dev scheduled job that summarises all notable actions from the previous day.

---

## PART 13 — PHASED IMPLEMENTATION ROADMAP

### PHASE 0 — Foundation (Weeks 1–4)
> "Get Supabase, Vercel and the multi-tenant shell running"

- [ ] Monorepo setup (Next.js 14 + TypeScript + Turborepo)
- [ ] Supabase project setup (PostgreSQL + Auth)
- [ ] Core database migrations (tenants, tenant_members, tenant_config)
- [ ] Custom JWT claims function (inject tenant_id + role into every JWT)
- [ ] Supabase Auth flow (email/password, magic link, SMS OTP)
- [ ] Next.js Edge Middleware (tenant resolution from hostname)
- [ ] Upstash Redis setup (tenant cache)
- [ ] White-labeling foundation (tenant_config schema + BrandingProvider)
- [ ] Vercel deployment + subdomain routing ({slug}.gh-hostels.com)
- [ ] Base RLS policies for all core tables
- [ ] shadcn/ui design system with CSS variable theming
- [ ] Audit log infrastructure (append-only table + auto-trigger)
- [ ] CI/CD: GitHub Actions → Vercel preview + production

### PHASE 1 — Core Operations (Weeks 5–12)
> "Get the first hostel running day-to-day"

- [ ] Tenant onboarding wizard (signup → branding setup → first room)
- [ ] Room & property management (CRUD, status workflow)
- [ ] Occupant management (profiles, Ghana Card intake, photo via camera)
- [ ] Booking & reservation engine (availability, hold timer, confirmation)
- [ ] Check-in / Check-out workflow
- [ ] Invoice auto-generation on booking
- [ ] Payment recording (MoMo + cash) via Paystack integration
- [ ] SMS notifications via Arkesel (booking confirmation, payment receipt)
- [ ] PDF receipt generation (React-PDF, offline-capable)
- [ ] Owner dashboard v1 (occupancy, today's revenue, activity feed via Supabase Realtime)
- [ ] Offline sync engine v1 (Dexie.js + Service Worker + push/pull)
- [ ] Occupant self-service portal (view balance, download receipt, raise request)
- [ ] Trigger.dev job: SMS dispatcher

### PHASE 2 — Financial & HR (Weeks 13–20)
> "Close the money loop and manage the team"

- [ ] Double-entry accounting engine (auto journal entries)
- [ ] Ghana chart of accounts template
- [ ] VAT/NHIL/GETFund-compliant invoice templates with hostel branding
- [ ] Bank reconciliation (CSV import, auto-match)
- [ ] P&L, Balance Sheet, Cash Flow statements
- [ ] HR module (staff profiles, Ghana Card, SSNIT, TIN)
- [ ] Attendance with GPS clock-in
- [ ] Leave management workflow
- [ ] Payroll: PAYE (Ghana tax bands), SSNIT (5.5% + 13%)
- [ ] Payslip PDF generation + WhatsApp delivery
- [ ] Trigger.dev jobs: report scheduler, payslip sender

### PHASE 3 — Operations Excellence + Website Integration (Weeks 21–28)
> "Replace paper completely and connect to the web"

- [ ] Housekeeping scheduling + mobile staff interface (ultra-simplified)
- [ ] Maintenance work order system + contractor directory
- [ ] Asset register with QR code support
- [ ] Preventive maintenance schedules
- [ ] Security visitor log + incident reporting
- [ ] Lost & found register
- [ ] Offline sync v2 (conflict resolution UI, sync status bar, retry)
- [ ] Communication hub (bulk SMS/WhatsApp via Arkesel)
- [ ] WhatsApp Business API for automated transactional messages
- [ ] Custom domain onboarding flow (Vercel Domains API integration)
- [ ] Per-hostel branding settings UI (logo upload, colour picker, domain setup)
- [ ] Hosted public booking page (SEO-ready, ISR, branded per tenant)
- [ ] Hosted booking page as full website (for Scenario B hostels with no site)
- [ ] JavaScript embed widget v1 (inline mode, Paystack MoMo, OTP verification)
- [ ] Widget CDN bundle build pipeline (Vite + Preact, < 45KB)
- [ ] CORS enforcement per tenant (allowed origins stored in tenant_config)
- [ ] Public API key generation + rotation UI in Settings → Website Integration
- [ ] Widget settings UI (snippet copy, mode picker, domain whitelist, platform guides)
- [ ] Booking confirmation: SMS + WhatsApp + QR code from widget flow
- [ ] Widget display modes: modal + floating button
- [ ] Provisional booking hold timer (configurable, default 15 min)
- [ ] Booking page SEO meta tags + sitemap per tenant

### PHASE 4 — Intelligence, Revenue & AI Website (Weeks 29–38)
> "Give owners superpowers and a world-class web presence"

- [ ] Revenue management module (yield pricing, RevPAR, forecasting)
- [ ] Anomaly detection rules engine (stored in DB, evaluated by Trigger.dev)
- [ ] Anomaly alerts via SMS to owner
- [ ] Custom report builder
- [ ] Scheduled report delivery (PDF via email)
- [ ] Multi-property portfolio dashboard (for owners with > 1 hostel)
- [ ] Push notifications (Web Push API via Supabase)
- [ ] Staff performance analytics
- [ ] Trigger.dev jobs: anomaly detector (every 15 min), weekly digest
- [ ] Premium website template system (4 templates: Luminary, Campus, Vibrant, Prestige)
- [ ] Website content CMS (hero, about, amenities, gallery, testimonials, FAQ, SEO)
- [ ] Live availability + scarcity indicators on website room pages
- [ ] Supabase pgvector setup for AI knowledge base
- [ ] FAQ embedding pipeline (Trigger.dev job: embed on save, OpenAI embeddings)
- [ ] Text chat AI agent v1 (Claude Haiku + Vercel AI SDK streaming)
- [ ] AI tool functions: check_availability, get_pricing, search_faqs, escalate_to_human
- [ ] Vapi integration: WebRTC voice agent on the website
- [ ] AI booking flow: create_booking + send_otp + verify_otp via conversation
- [ ] AI payment flow: initiate_payment (Paystack MoMo) through conversation
- [ ] Per-hostel AI agent configuration UI (name, personality, language, capabilities)
- [ ] Website publish flow (ISR revalidation on content change)
- [ ] Website live preview in dashboard (iframe preview mode)

### PHASE 5 — Platform, Scale & AI Polish (Weeks 39–48)
> "Productise, open to market, and make the AI exceptional"

- [ ] Super-admin platform console (manage all tenants, billing, support)
- [ ] Subscription billing (Paystack recurring billing for SaaS plans)
- [ ] Public hostel directory / marketplace (GH Hostels.com listings)
- [ ] Native Android app (React Native wrapping PWA core — Android first)
- [ ] i18n: Twi language pack (Arkesel supports Twi SMS, AI speaks Twi)
- [ ] GRA e-VAT integration (when API becomes available)
- [ ] Interbank payroll file export (GH-INTER format)
- [ ] Data portability (tenant can export all their data as CSV/JSON)
- [ ] Public REST API v1 with developer documentation site
- [ ] Webhook system (booking.confirmed, payment.received, etc.)
- [ ] WordPress plugin for one-click widget installation
- [ ] API rate limiting dashboard (owners see usage of their public API key)
- [ ] Widget analytics (views, booking conversions, drop-off by step)
- [ ] AI agent phone number provisioning per tenant (Vapi phone numbers)
- [ ] AI WhatsApp integration (same agent brain, WhatsApp Business API channel)
- [ ] AI conversation logs and analytics dashboard (owner sees every conversation)
- [ ] AI bookings revenue attribution (how much revenue came through AI vs reception)
- [ ] AI A/B testing (try two personalities, see which converts better)
- [ ] Google Reviews integration on premium website (Phase 5)
- [ ] Website Google Analytics integration (owner sees traffic, bookings, conversions)
- [ ] Upgrade path: extract heavy business logic to Railway (NestJS) if needed

---

## SUBSCRIPTION PLANS

### Core HMS Plans

| Feature | Starter (GHS 199/mo) | Growth (GHS 499/mo) | Enterprise (GHS 999/mo) |
|---|---|---|---|
| Rooms | Up to 30 | Up to 100 | Unlimited |
| Staff accounts | 5 | 20 | Unlimited |
| Properties | 1 | 3 | Unlimited |
| Offline sync | Basic | Full | Full |
| SMS credits | 100/mo | 500/mo | 2,000/mo |
| Custom domain (app) | No | Yes | Yes |
| Custom branding | Basic (colours) | Full (logo + colours + fonts) | Full + white-label |
| Hosted booking page | Yes (.gh-hostels.com) | Yes (custom domain) | Yes (custom domain + SEO) |
| JS embed widget | No | Yes | Yes |
| Widget allowed domains | N/A | 2 domains | Unlimited |
| Public REST API | No | Yes | Yes |
| Webhooks | No | No | Yes |
| Widget analytics | No | Basic | Full |
| Priority support | No | Email | Phone + Email + WhatsApp |
| Data export | No | Yes | Yes |

### Premium Website Add-On (GHS 150/mo — available from Growth plan)

| Feature | Included |
|---|---|
| Premium website template (4 choices) | Yes |
| Visual content CMS (no code required) | Yes |
| Live room availability on website | Yes |
| Scarcity indicators ("3 rooms left") | Yes |
| SEO meta tags + sitemap | Yes |
| Gallery, testimonials, amenities sections | Yes |
| Hosted on hostel's own domain | Yes |
| Website analytics (Vercel Analytics) | Yes |

### AI Agent Add-On (GHS 250/mo — requires Premium Website)

| Feature | Included |
|---|---|
| Chat AI agent on website (text) | Yes |
| Voice AI agent on website (WebRTC) | Yes |
| AI phone number (Vapi, 24/7) | Yes |
| Booking through conversation | Yes |
| MoMo payment through conversation | Yes |
| Custom agent name and personality | Yes |
| Twi language support | Yes |
| Per-hostel FAQ knowledge base | Yes |
| AI conversation logs and analytics | Yes |
| Voice calls (included minutes) | 100 min/mo |
| Additional voice: | GHS 0.60/min |
| Human escalation via SMS | Yes |

### Effective Pricing Summary

```
Starter only:            GHS 199/mo   — HMS only, no web integration
Growth:                  GHS 499/mo   — HMS + widget embed
Growth + Website:        GHS 649/mo   — HMS + premium website
Growth + Website + AI:   GHS 899/mo   — Full stack (most popular)
Enterprise:              GHS 999/mo   — HMS unlimited + full features
Enterprise + Website:    GHS 1,149/mo — Largest hostels, full suite
Enterprise + Website + AI: GHS 1,399/mo — Premium flagship offering
```

---

---

## RELATED DOCUMENTS

| Document | Description |
|---|---|
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Adinkra Design System — full UI/UX specification including color tokens, typography, components, role-specific patterns, and tenant theme override system |

---

*GH Hostels — Architecture v4.0 — April 2026*
*Startup-optimised: Supabase + Vercel + Upstash + Trigger.dev*
*Website Integration: Hosted Booking Page + JS Embed Widget + Public REST API*
*AI Website: 4 Premium Templates + Voice/Chat AI Agent (Vapi + Claude + pgvector)*
*Designed for the Ghanaian hostel market*
