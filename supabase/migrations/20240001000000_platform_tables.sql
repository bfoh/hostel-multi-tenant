-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 001 — Platform Tables
-- AbrempongHMS multi-tenant SaaS foundation
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable required extensions
create extension if not exists "uuid-ossp"  schema extensions;
create extension if not exists "pgcrypto"   schema extensions;
create extension if not exists "pg_trgm"    schema extensions;  -- fuzzy name search
create extension if not exists "unaccent"   schema extensions;  -- accent-insensitive search (Twi names)
create extension if not exists "btree_gist" schema extensions;  -- needed for EXCLUDE constraints

-- ── Enum types ───────────────────────────────────────────────────────────────

create type subscription_plan as enum (
  'starter',      -- 1 hostel, 50 rooms, 2 staff
  'growth',       -- 1 hostel, 200 rooms, 10 staff
  'pro',          -- 3 hostels, unlimited rooms, unlimited staff
  'enterprise'    -- custom
);

create type tenant_status as enum ('trial', 'active', 'suspended', 'cancelled');

create type tenant_role as enum (
  'owner', 'manager', 'receptionist', 'housekeeper', 'accountant', 'security', 'occupant'
);

create type room_status as enum (
  'available', 'occupied', 'reserved', 'maintenance', 'blocked'
);

create type housekeeping_status as enum (
  'clean', 'dirty', 'inspecting', 'out_of_order'
);

create type room_type as enum (
  'single', 'double', 'twin', 'triple', 'quad', 'dormitory', 'suite', 'studio'
);

create type booking_status as enum (
  'enquiry', 'pending_payment', 'confirmed', 'checked_in',
  'checked_out', 'cancelled', 'no_show'
);

create type booking_source as enum (
  'walk_in', 'phone', 'website', 'widget', 'voice_ai', 'referral'
);

create type payment_status as enum (
  'unpaid', 'partial', 'paid', 'refunded', 'disputed'
);

create type payment_method as enum (
  'momo_mtn', 'momo_vodafone', 'momo_airteltigo',
  'card', 'bank_transfer', 'cash', 'cheque'
);

create type occupant_type as enum ('student', 'professional', 'guest', 'staff');
create type occupant_status as enum ('active', 'checked_out', 'pending', 'suspended', 'blacklisted');
create type gender_type as enum ('male', 'female', 'prefer_not_to_say');
create type id_type as enum ('ghana_card', 'passport', 'voters_id', 'nhis');

-- ── Tenants ──────────────────────────────────────────────────────────────────

create table tenants (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,   -- subdomain: acme.abrempong.com
  name             text not null,
  plan             subscription_plan not null default 'starter',
  status           tenant_status not null default 'trial',
  trial_ends_at    timestamptz,
  custom_domain    text unique,            -- e.g. "app.acmehostel.com"

  -- Branding
  primary_color    text,                   -- HSL components e.g. "207 58% 28%"
  accent_color     text,
  logo_url         text,
  favicon_url      text,
  font_display     text,
  font_body        text,

  -- Config
  currency         text not null default 'GHS',
  timezone         text not null default 'Africa/Accra',
  country          char(2) not null default 'GH',
  sms_enabled      boolean not null default true,
  email_enabled    boolean not null default true,
  momo_enabled     boolean not null default true,
  card_enabled     boolean not null default false,
  voice_ai_enabled boolean not null default false,
  widget_enabled   boolean not null default false,
  widget_api_key   text unique default encode(gen_random_bytes(24), 'hex'),
  ai_persona_name  text,
  ai_persona_voice text,
  semester_system  boolean not null default true,
  auto_checkout_enabled boolean not null default false,
  late_checkout_fee_percent smallint not null default 0 check (late_checkout_fee_percent between 0 and 100),

  -- Billing (Paystack customer ID stored here)
  paystack_customer_id text,
  billing_email    text,

  is_active        boolean not null generated always as (status = 'active') stored,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table tenants is
  'Top-level tenant record. One row per hostel organisation.';

-- ── Tenant members (staff accounts) ──────────────────────────────────────────

create table tenant_members (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         tenant_role not null default 'receptionist',
  is_active    boolean not null default true,
  invited_by   uuid references auth.users(id),
  invited_at   timestamptz,
  joined_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (tenant_id, user_id)
);

-- ── updated_at trigger function ───────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenants_updated_at
  before update on tenants
  for each row execute function set_updated_at();

create trigger tenant_members_updated_at
  before update on tenant_members
  for each row execute function set_updated_at();

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index on tenants (slug);
create index on tenants (custom_domain);
create index on tenants (status);
create index on tenant_members (tenant_id);
create index on tenant_members (user_id);
create index on tenant_members (tenant_id, role);

-- ── JWT claims hook ───────────────────────────────────────────────────────────
-- Injects tenant_id and role into the JWT so RLS policies can read them
-- without a DB lookup per request.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql security definer as $$
declare
  claims      jsonb;
  member_rec  record;
begin
  claims = coalesce(event -> 'claims', '{}'::jsonb);

  select tm.tenant_id, tm.role, t.slug
  into   member_rec
  from   tenant_members tm
  join   tenants t on t.id = tm.tenant_id
  where  tm.user_id = (event ->> 'user_id')::uuid
    and  tm.is_active = true
  limit  1;

  if found then
    claims = jsonb_set(claims, '{tenant_id}', to_jsonb(member_rec.tenant_id::text));
    claims = jsonb_set(claims, '{tenant_role}', to_jsonb(member_rec.role::text));
    claims = jsonb_set(claims, '{tenant_slug}', to_jsonb(member_rec.slug));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Grant execute to the supabase_auth_admin role (required by Supabase hook system)
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
