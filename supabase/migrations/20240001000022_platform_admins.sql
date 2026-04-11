-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 022 — Platform admins (super-admin role)
-- ═══════════════════════════════════════════════════════════════════════════

create table platform_admins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table platform_admins is
  'Users with super-admin access to the platform operator panel.';

-- Only service role can read this table — no RLS needed (disable to lock it down)
alter table platform_admins enable row level security;
create policy "platform_admins_service_only" on platform_admins
  using (false); -- deny all anon/user reads; service role bypasses RLS

-- Update JWT hook to inject is_super_admin claim
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql security definer as $$
declare
  claims      jsonb;
  member_rec  record;
  is_admin    boolean;
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
    claims = jsonb_set(claims, '{tenant_id}',   to_jsonb(member_rec.tenant_id::text));
    claims = jsonb_set(claims, '{tenant_role}',  to_jsonb(member_rec.role::text));
    claims = jsonb_set(claims, '{tenant_slug}',  to_jsonb(member_rec.slug));
  end if;

  select exists(
    select 1 from platform_admins where user_id = (event ->> 'user_id')::uuid
  ) into is_admin;

  if is_admin then
    claims = jsonb_set(claims, '{is_super_admin}', 'true'::jsonb);
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;
