# AbrempongHMS

> Modern hostel management system for Ghana — multi-tenant, offline-first, AI-powered.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Database / Auth | Supabase (PostgreSQL + RLS + Auth) |
| Styling | Tailwind CSS + Adinkra Design System |
| State | TanStack Query + Zustand |
| Offline | Dexie.js (IndexedDB) + Workbox |
| Payments | Paystack (MoMo + Card) |
| SMS | Arkesel |
| Background Jobs | Trigger.dev |
| Voice AI | Vapi + Claude Haiku |
| Monorepo | Turborepo |
| Hosting | Vercel |

## Repository Structure

```
abrempong/
├── apps/
│   └── web/                    # Next.js 15 application
│       ├── app/                # App Router pages
│       │   ├── (auth)/         # Login, signup, password reset
│       │   └── (tenant)/       # Authenticated hostel pages
│       ├── components/
│       │   ├── ui/             # Adinkra Design System components
│       │   ├── layout/         # Sidebar, header
│       │   ├── dashboard/      # Dashboard widgets
│       │   └── providers/      # React context providers
│       └── lib/
│           ├── supabase/       # Browser, server, admin clients
│           └── tenant/         # Tenant resolver (Redis + Supabase)
├── packages/
│   ├── types/                  # Shared TypeScript types
│   └── ui/                     # Shared component library (growing)
└── supabase/
    ├── config.toml
    └── migrations/             # SQL migrations (run in order)
```

## Getting Started

### Prerequisites

- Node.js ≥ 20
- npm ≥ 10
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Vercel CLI](https://vercel.com/docs/cli) (optional, for deployment)

### 1. Clone and install

```bash
git clone https://github.com/bfoh/hostel-multi-tenant.git
cd hostel-multi-tenant
npm install
```

### 2. Environment variables

```bash
cp .env.example apps/web/.env.local
# Fill in your Supabase, Upstash Redis, Paystack, and other keys
```

### 3. Start Supabase locally

```bash
npx supabase start
npx supabase db reset   # applies all migrations
```

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Generate TypeScript types from schema

```bash
npx supabase gen types typescript --local \
  > packages/types/src/database.generated.ts
```

## Supabase Setup (production)

1. Create a project at [supabase.com](https://supabase.com)
2. Run migrations: `npx supabase db push`
3. Enable the **custom access token hook** in Supabase Dashboard:
   - Auth → Hooks → Custom Access Token → `public.custom_access_token_hook`
4. Add your environment variables to Vercel

## Multi-Tenancy

Each hostel gets a subdomain: `{slug}.abrempong.com`. Custom domains are also supported.

**Resolution flow:**
1. Edge Middleware reads the incoming hostname
2. Checks Upstash Redis cache (TTL 5 min)
3. On miss, queries `tenants` table by `slug` or `custom_domain`
4. Injects `x-tenant-id`, `x-tenant-slug`, `x-tenant-name` headers
5. All database queries are automatically scoped by RLS using the `tenant_id` JWT claim

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all apps in development |
| `npm run build` | Build all apps |
| `npm run lint` | Lint all workspaces |
| `npm run type-check` | TypeScript check across monorepo |
| `npm run format` | Prettier format |

## Design System

The **Adinkra Design System** uses a three-layer token architecture:

```
Primitive tokens  →  Semantic tokens  →  Component styles
(Volta Blue HSL)     (--color-brand)      (bg-brand)
```

Tenant theming: override `--color-brand` with any HSL value. The entire palette (hover states, subtle backgrounds) recalculates automatically.

See `DESIGN_SYSTEM.md` for full specification.

## License

Private — All rights reserved © 2024 AbrempongHMS.
