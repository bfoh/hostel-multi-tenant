-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 053 — Revenue Points Module
-- Gym, cafeteria, mini-mart, laundry, restaurant, parking, printing, etc.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Revenue point definitions ────────────────────────────────────────────────

create table revenue_points (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  type        text not null check (type in (
                'gym','cafeteria','restaurant','mini_mart',
                'laundry','printing','parking','other')),
  description text,
  manager_id  uuid references auth.users(id),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, name)
);

create trigger revenue_points_updated_at
  before update on revenue_points
  for each row execute function set_updated_at();

create index on revenue_points (tenant_id, is_active);

alter table revenue_points enable row level security;

create policy "tenant members can manage revenue points"
  on revenue_points for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );

-- ── Products / services sold at each revenue point ───────────────────────────

create table revenue_point_items (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  revenue_point_id uuid not null references revenue_points(id) on delete cascade,
  name             text not null,
  category         text,                    -- beverages, meals, passes, etc.
  unit_price       integer not null,        -- pesewas
  unit             text not null default 'item',  -- item, kg, plate, session, etc.
  is_active        boolean not null default true,
  sort_order       smallint not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger revenue_point_items_updated_at
  before update on revenue_point_items
  for each row execute function set_updated_at();

create index on revenue_point_items (revenue_point_id, is_active);

alter table revenue_point_items enable row level security;

create policy "tenant members can manage revenue point items"
  on revenue_point_items for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );

-- ── Individual sales ─────────────────────────────────────────────────────────

create table revenue_point_sales (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  revenue_point_id uuid not null references revenue_points(id),
  item_id          uuid references revenue_point_items(id),
  description      text not null,
  quantity         numeric(10,2) not null default 1,
  unit_price       integer not null,         -- pesewas at time of sale
  total_amount     integer not null,         -- pesewas (quantity × unit_price)
  payment_method   text not null check (payment_method in (
                     'cash','momo_mtn','momo_vodafone','momo_airteltigo',
                     'bank_transfer','card','on_account')),
  reference        text,
  customer_name    text,
  occupant_id      uuid references occupants(id) on delete set null,
  sold_by          uuid references auth.users(id),
  sold_at          timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create index on revenue_point_sales (tenant_id, sold_at desc);
create index on revenue_point_sales (revenue_point_id, sold_at desc);
create index on revenue_point_sales (tenant_id, revenue_point_id, sold_at desc);

alter table revenue_point_sales enable row level security;

create policy "tenant members can manage revenue point sales"
  on revenue_point_sales for all
  using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );

-- ── Extend Chart of Accounts with new revenue codes ─────────────────────────

-- Add new accounts for each revenue type.
-- Uses ON CONFLICT to skip if already seeded.
do $$
declare
  t record;
begin
  for t in select id from tenants loop
    insert into chart_of_accounts (tenant_id, code, name, type, is_system, sort_order) values
      (t.id, '4040', 'Gym Revenue',          'revenue', false, 340),
      (t.id, '4050', 'Cafeteria Revenue',    'revenue', false, 350),
      (t.id, '4060', 'Mini-Mart Revenue',    'revenue', false, 360),
      (t.id, '4070', 'Parking Revenue',      'revenue', false, 370),
      (t.id, '4080', 'Printing & Services',  'revenue', false, 380)
    on conflict (tenant_id, code) do nothing;
  end loop;
end;
$$;

-- ── Auto-journal trigger for revenue point sales ─────────────────────────────

create or replace function revenue_point_type_to_code(p_type text)
returns text language sql immutable as $$
  select case p_type
    when 'gym'        then '4040'
    when 'cafeteria'  then '4050'
    when 'restaurant' then '4050'   -- shares cafeteria account
    when 'mini_mart'  then '4060'
    when 'laundry'    then '4020'   -- existing Laundry Income
    when 'parking'    then '4070'
    when 'printing'   then '4080'
    else                   '4030'   -- Other Income (existing)
  end
$$;

create or replace function journal_revenue_point_sale()
returns trigger language plpgsql as $$
declare
  v_entry_id    uuid;
  v_rev_code    text;
  v_cash_code   text;
  v_rev_acct_id uuid;
  v_cash_id     uuid;
  v_rp_type     text;
  v_desc        text;
begin
  -- On delete, reverse
  if TG_OP in ('UPDATE', 'DELETE') then
    delete from journal_entries
     where source    = 'revenue_point'
       and source_id = old.id;
  end if;

  if TG_OP = 'DELETE' then
    return old;
  end if;

  -- Look up the revenue point type
  select type into v_rp_type
    from revenue_points
   where id = new.revenue_point_id;

  v_rev_code  := revenue_point_type_to_code(v_rp_type);
  v_cash_code := payment_method_to_cash_code(new.payment_method);
  v_desc      := coalesce(v_rp_type, 'sale') || ' — ' || new.description;

  select id into v_rev_acct_id
    from chart_of_accounts
   where tenant_id = new.tenant_id and code = v_rev_code limit 1;

  select id into v_cash_id
    from chart_of_accounts
   where tenant_id = new.tenant_id and code = v_cash_code limit 1;

  if v_rev_acct_id is null or v_cash_id is null then
    return new;
  end if;

  insert into journal_entries
    (tenant_id, entry_date, reference, description, source, source_id)
  values
    (new.tenant_id, new.sold_at::date, new.reference, v_desc, 'revenue_point', new.id)
  returning id into v_entry_id;

  -- DR Cash / CR Revenue
  insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
  values (v_entry_id, new.tenant_id, v_cash_id, new.total_amount, 0);

  insert into journal_lines (entry_id, tenant_id, account_id, debit, credit)
  values (v_entry_id, new.tenant_id, v_rev_acct_id, 0, new.total_amount);

  return new;
end;
$$;

create trigger revenue_point_sale_journal
  after insert or update or delete on revenue_point_sales
  for each row execute function journal_revenue_point_sale();
