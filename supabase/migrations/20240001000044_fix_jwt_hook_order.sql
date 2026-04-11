-- Fix JWT hook: check occupants FIRST so occupant portal_role is never
-- overwritten by a tenant_members row (e.g. staff role from old test data).
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql security definer as $$
declare
  claims       jsonb;
  member_rec   record;
  occupant_rec record;
  is_admin     boolean := false;
begin
  claims := coalesce(event -> 'claims', '{}'::jsonb);

  -- 1. Check occupants table FIRST — occupants must never be misrouted as staff.
  begin
    select o.id, o.tenant_id, o.first_name, o.last_name,
           t.slug, t.name, t.logo_url, t.primary_color
    into   occupant_rec
    from   occupants o
    join   tenants t on t.id = o.tenant_id
    where  o.user_id = (event ->> 'user_id')::uuid
    limit  1;

    if found then
      claims := jsonb_set(claims, '{tenant_id}',   to_jsonb(occupant_rec.tenant_id::text));
      claims := jsonb_set(claims, '{tenant_slug}',  to_jsonb(occupant_rec.slug));
      claims := jsonb_set(claims, '{tenant_name}',  to_jsonb(occupant_rec.name));
      claims := jsonb_set(claims, '{portal_role}',  to_jsonb('occupant'::text));
      claims := jsonb_set(claims, '{occupant_id}',  to_jsonb(occupant_rec.id::text));
      if occupant_rec.logo_url is not null then
        claims := jsonb_set(claims, '{tenant_logo}',  to_jsonb(occupant_rec.logo_url));
      end if;
      if occupant_rec.primary_color is not null then
        claims := jsonb_set(claims, '{tenant_color}', to_jsonb(occupant_rec.primary_color));
      end if;

      -- Early return — no need to check tenant_members for occupants
      return jsonb_set(event, '{claims}', claims);
    end if;
  exception when others then null;
  end;

  -- 2. Check tenant_members (owner / manager / staff / receptionist etc.)
  begin
    select tm.tenant_id, tm.role, t.slug, t.name, t.logo_url, t.primary_color
    into   member_rec
    from   tenant_members tm
    join   tenants t on t.id = tm.tenant_id
    where  tm.user_id = (event ->> 'user_id')::uuid
      and  tm.is_active = true
    limit  1;

    if found then
      claims := jsonb_set(claims, '{tenant_id}',   to_jsonb(member_rec.tenant_id::text));
      claims := jsonb_set(claims, '{tenant_role}',  to_jsonb(member_rec.role::text));
      claims := jsonb_set(claims, '{tenant_slug}',  to_jsonb(member_rec.slug));
      claims := jsonb_set(claims, '{tenant_name}',  to_jsonb(member_rec.name));
      claims := jsonb_set(claims, '{portal_role}',  to_jsonb(
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
