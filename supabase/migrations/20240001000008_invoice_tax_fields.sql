-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 009 — GRA-Compliant Invoice Tax Fields
-- Splits tax_amount into VAT (15%), NHIL (2.5%), GETFund (2.5%)
-- Adds TIN + VAT registration number to tenants
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Add Ghana Revenue Authority fields to tenants ─────────────────────────

alter table tenants
  add column if not exists tin              text,          -- Ghana Revenue Authority TIN
  add column if not exists vat_reg_number   text,          -- VAT registration number (if registered)
  add column if not exists is_vat_registered boolean not null default false;

-- ── Add itemised tax columns to bookings ──────────────────────────────────

alter table bookings
  add column if not exists vat_amount      integer not null default 0 check (vat_amount >= 0),
  add column if not exists nhil_amount     integer not null default 0 check (nhil_amount >= 0),
  add column if not exists getfund_amount  integer not null default 0 check (getfund_amount >= 0);

-- ── Back-fill from existing tax_amount (split 15 : 2.5 : 2.5 = 6 : 1 : 1)
-- Only affects rows where tax_amount > 0 but new columns are still 0

update bookings
set
  vat_amount     = round(tax_amount * 0.75)::integer,   -- 15/20
  nhil_amount    = round(tax_amount * 0.125)::integer,  -- 2.5/20
  getfund_amount = round(tax_amount * 0.125)::integer   -- 2.5/20
where tax_amount > 0
  and vat_amount = 0
  and nhil_amount = 0
  and getfund_amount = 0;

-- ── Add invoice_number column to bookings (GRA requires sequential numbering)

alter table bookings
  add column if not exists invoice_number text;

-- ── Sequence for invoice numbers per tenant ───────────────────────────────
-- We use a simple counter — format: HMS-{YEAR}-{SEQUENCE}

create or replace function generate_invoice_number(p_tenant_id uuid)
returns text language plpgsql as $$
declare
  v_year  text;
  v_seq   integer;
begin
  v_year := to_char(now(), 'YYYY');

  select coalesce(max(
    case
      when invoice_number ~ ('^HMS-' || v_year || '-\d+$')
      then (regexp_match(invoice_number, '\d+$'))[1]::integer
      else 0
    end
  ), 0) + 1
  into v_seq
  from bookings
  where tenant_id = p_tenant_id;

  return 'HMS-' || v_year || '-' || lpad(v_seq::text, 5, '0');
end;
$$;

-- Back-fill invoice numbers for existing bookings that have none
do $$
declare
  r record;
begin
  for r in
    select id, tenant_id, created_at
    from bookings
    where invoice_number is null
    order by tenant_id, created_at
  loop
    update bookings
    set invoice_number = generate_invoice_number(r.tenant_id)
    where id = r.id;
  end loop;
end;
$$;
