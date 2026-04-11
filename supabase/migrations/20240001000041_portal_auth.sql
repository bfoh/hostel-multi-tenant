-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 041 — Portal Auth
-- Links occupants and staff to Supabase auth accounts.
-- Adds portal_role to JWT claims for routing.
-- ═══════════════════════════════════════════════════════════════════════════

-- Link occupants to auth users
alter table occupants
  add column if not exists user_id uuid unique references auth.users(id) on delete set null,
  add column if not exists portal_enabled boolean not null default false,
  add column if not exists portal_invite_sent_at timestamptz;

create index if not exists occupants_user_id_idx on occupants (user_id) where user_id is not null;

-- Allow occupants to read their own booking data via RLS
create policy "occupant can read own bookings"
  on bookings for select
  using (
    occupant_id in (
      select id from occupants where user_id = auth.uid()
    )
  );

create policy "occupant can read own payments"
  on booking_payments for select
  using (
    booking_id in (
      select b.id from bookings b
      join occupants o on o.id = b.occupant_id
      where o.user_id = auth.uid()
    )
  );

-- Allow occupants to create maintenance requests
create policy "occupant can create maintenance request"
  on maintenance_requests for insert
  with check (
    tenant_id in (
      select tm.tenant_id from tenant_members tm where tm.user_id = auth.uid()
      union
      select o.tenant_id from occupants o where o.user_id = auth.uid()
    )
  );

-- RLS for invoices (only add if table exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'invoices') then
    execute $policy$
      create policy "occupant can read own invoices"
        on invoices for select
        using (
          booking_id in (
            select b.id from bookings b
            join occupants o on o.id = b.occupant_id
            where o.user_id = auth.uid()
          )
        )
    $policy$;
  end if;
end $$;

-- ── Update JWT hook to inject portal_role ──────────────────────────────────
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql security definer as $$
declare
  claims      jsonb;
  member_rec  record;
  occupant_rec record;
  is_admin    boolean := false;
begin
  claims := coalesce(event -> 'claims', '{}'::jsonb);

  -- 1. Check tenant_members (owner / manager / staff / receptionist etc.)
  begin
    select tm.tenant_id, tm.role, t.slug, t.name, t.logo_url, t.primary_color
    into   member_rec
    from   tenant_members tm
    join   tenants t on t.id = tm.tenant_id
    where  tm.user_id = (event ->> 'user_id')::uuid
      and  tm.is_active = true
    limit  1;

    if found then
      claims := jsonb_set(claims, '{tenant_id}',    to_jsonb(member_rec.tenant_id::text));
      claims := jsonb_set(claims, '{tenant_role}',   to_jsonb(member_rec.role::text));
      claims := jsonb_set(claims, '{tenant_slug}',   to_jsonb(member_rec.slug));
      claims := jsonb_set(claims, '{tenant_name}',   to_jsonb(member_rec.name));
      claims := jsonb_set(claims, '{portal_role}',   to_jsonb(
        case
          when member_rec.role in ('owner', 'manager', 'admin') then 'admin'
          else 'staff'
        end
      ));
      if member_rec.logo_url is not null then
        claims := jsonb_set(claims, '{tenant_logo}',  to_jsonb(member_rec.logo_url));
      end if;
      if member_rec.primary_color is not null then
        claims := jsonb_set(claims, '{tenant_color}', to_jsonb(member_rec.primary_color));
      end if;
    end if;
  exception when others then null;
  end;

  -- 2. Check occupants table (student/occupant portal users)
  begin
    select o.id, o.tenant_id, o.first_name, o.last_name,
           t.slug, t.name, t.logo_url, t.primary_color
    into   occupant_rec
    from   occupants o
    join   tenants t on t.id = o.tenant_id
    where  o.user_id = (event ->> 'user_id')::uuid
    limit  1;

    if found then
      claims := jsonb_set(claims, '{tenant_id}',    to_jsonb(occupant_rec.tenant_id::text));
      claims := jsonb_set(claims, '{tenant_slug}',   to_jsonb(occupant_rec.slug));
      claims := jsonb_set(claims, '{tenant_name}',   to_jsonb(occupant_rec.name));
      claims := jsonb_set(claims, '{portal_role}',   to_jsonb('occupant'::text));
      claims := jsonb_set(claims, '{occupant_id}',   to_jsonb(occupant_rec.id::text));
      if occupant_rec.logo_url is not null then
        claims := jsonb_set(claims, '{tenant_logo}',  to_jsonb(occupant_rec.logo_url));
      end if;
      if occupant_rec.primary_color is not null then
        claims := jsonb_set(claims, '{tenant_color}', to_jsonb(occupant_rec.primary_color));
      end if;
    end if;
  exception when others then null;
  end;

  -- 3. Super-admin check
  begin
    select exists(
      select 1 from platform_admins where user_id = (event ->> 'user_id')::uuid
    ) into is_admin;
  exception when others then null;
  end;

  if is_admin then
    claims := jsonb_set(claims, '{is_super_admin}', 'true'::jsonb);
  end if;

  return jsonb_set(event, '{claims}', claims);

exception when others then
  return event;
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
