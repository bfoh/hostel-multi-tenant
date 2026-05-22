-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 095 — Compatibility-Based Roommate Matching
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Alter tenants table to support roommate matching toggle
alter table tenants
  add column if not exists roommate_matching_enabled boolean not null default false;

-- 2. Create occupant matching profiles table
create table occupant_matching_profiles (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  occupant_id         uuid not null references occupants(id) on delete cascade,
  
  -- Lifestyle Survey Data
  cleanliness         integer check (cleanliness between 1 and 5),
  sleep_schedule      text check (sleep_schedule in ('early_bird', 'night_owl', 'flexible')),
  study_preference    text check (study_preference in ('in_room_quiet', 'in_room_background_noise', 'library')),
  guest_frequency     text check (guest_frequency in ('none', 'rare', 'frequent')),
  noise_tolerance     integer check (noise_tolerance between 1 and 5),
  ac_preference       text check (ac_preference in ('ac_cold', 'fan_only', 'no_preference')),
  hobbies             text[] not null default '{}',
  
  -- Religion & Relationships
  religion            text check (religion in ('christian', 'muslim', 'traditional', 'other', 'none', 'prefer_not_to_say')),
  religiosity_level   text check (religiosity_level in ('devout', 'moderate', 'not_religious')),
  relationship_status text check (relationship_status in ('single', 'in_relationship', 'married')),
  
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  
  unique (tenant_id, occupant_id)
);

-- 3. Add triggers for updated_at timestamps
create trigger occupant_matching_profiles_updated_at
  before update on occupant_matching_profiles
  for each row execute function set_updated_at();

-- 4. Create performance indexes
create index on occupant_matching_profiles (tenant_id);
create index on occupant_matching_profiles (occupant_id);

-- 5. Enable RLS
alter table occupant_matching_profiles enable row level security;

-- 6. Create RLS policies
create policy "staff_can_manage_matching_profiles"
  on occupant_matching_profiles for all
  using (
    tenant_id = public.tenant_id()
    and public.tenant_role() in ('owner', 'manager', 'receptionist')
  );

create policy "occupants_can_read_own_profile"
  on occupant_matching_profiles for select
  using (
    tenant_id = public.tenant_id()
    and occupant_id in (
      select id from occupants where user_id = auth.uid()
    )
  );

create policy "occupants_can_write_own_profile"
  on occupant_matching_profiles for insert
  with check (
    tenant_id = public.tenant_id()
    and occupant_id in (
      select id from occupants where user_id = auth.uid()
    )
  );

create policy "occupants_can_update_own_profile"
  on occupant_matching_profiles for update
  using (
    tenant_id = public.tenant_id()
    and occupant_id in (
      select id from occupants where user_id = auth.uid()
    )
  );
