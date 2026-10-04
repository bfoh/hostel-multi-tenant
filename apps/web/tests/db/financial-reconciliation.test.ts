import { randomUUID } from 'node:crypto'

import type { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { startTestDb, type TestDb } from './harness'

let db: TestDb
let client: Client

const tenantId = randomUUID()
const actorId = randomUUID()
const extensionActorId = randomUUID()
const occupantId = randomUUID()
const roomId = randomUUID()
const bookingId = randomUUID()

beforeAll(async () => {
  db = await startTestDb({
    beforeExtraMigrations: `
      alter type booking_status add value if not exists 'pending_confirmation' before 'confirmed';
      alter type payment_method add value if not exists 'bank_draft';
      create type account_type as enum ('asset', 'liability', 'equity', 'revenue', 'expense');
      create type journal_source as enum ('booking_payment', 'payroll', 'expense', 'refund', 'manual', 'bank_reconciliation', 'revenue_point');

      create table chart_of_accounts (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id) on delete cascade,
        code text not null,
        name text not null,
        type account_type not null,
        is_system boolean not null default false,
        is_active boolean not null default true,
        sort_order smallint not null default 0,
        unique (tenant_id, code)
      );
      create table journal_entries (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id) on delete cascade,
        entry_date date not null default current_date,
        reference text,
        description text not null,
        source journal_source not null default 'manual',
        source_id uuid,
        posted_by uuid references auth.users(id),
        created_at timestamptz not null default now(),
        voided_at timestamptz,
        voided_by uuid references auth.users(id),
        void_reason text,
        reverses_entry_id uuid references journal_entries(id)
      );
      create table journal_lines (
        id uuid primary key default gen_random_uuid(),
        entry_id uuid not null references journal_entries(id) on delete cascade,
        tenant_id uuid not null references tenants(id) on delete cascade,
        account_id uuid not null references chart_of_accounts(id),
        description text,
        debit integer not null default 0 check (debit >= 0),
        credit integer not null default 0 check (credit >= 0),
        created_at timestamptz not null default now(),
        check (debit > 0 or credit > 0),
        check (not (debit > 0 and credit > 0))
      );
      create or replace function payment_method_to_cash_code(p_method text)
      returns text language sql immutable as $$
        select case p_method when 'cash' then '1010' else '1020' end
      $$;

      create table payment_plans (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id) on delete cascade,
        booking_id uuid not null references bookings(id) on delete cascade,
        name text not null,
        total_amount numeric(12,2) not null,
        installments_count int not null,
        created_by uuid references auth.users(id),
        created_at timestamptz not null default now(),
        unique (booking_id)
      );
      create table payment_plan_installments (
        id uuid primary key default gen_random_uuid(),
        plan_id uuid not null references payment_plans(id) on delete cascade,
        tenant_id uuid not null references tenants(id) on delete cascade,
        installment_number int not null,
        amount numeric(12,2) not null,
        due_date date not null,
        status text not null default 'pending' check (status in ('pending', 'paid', 'overdue', 'waived')),
        paid_at timestamptz,
        payment_method text,
        reference text,
        notes text,
        created_at timestamptz not null default now()
      );
      create table booking_charges (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id) on delete cascade,
        booking_id uuid not null references bookings(id) on delete cascade,
        description text not null,
        category text not null,
        quantity integer not null default 1,
        unit_price integer not null,
        amount integer generated always as (quantity * unit_price) stored,
        payment_method payment_method,
        paid boolean not null default true,
        notes text,
        created_by uuid not null references auth.users(id),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create table booking_payment_exceptions (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id) on delete cascade,
        booking_id uuid not null references bookings(id) on delete cascade,
        paystack_reference text not null,
        exception_type text not null,
        status text not null default 'open',
        amount integer not null check (amount > 0),
        details jsonb not null default '{}'::jsonb,
        resolved_by uuid references auth.users(id),
        resolved_at timestamptz,
        created_at timestamptz not null default now(),
        unique (tenant_id, paystack_reference, exception_type)
      );
      create table audit_log (
        id bigserial primary key,
        tenant_id uuid not null,
        actor_id uuid,
        actor_name text,
        actor_role text,
        action text not null,
        entity_type text,
        entity_id uuid,
        description text,
        old_values jsonb,
        new_values jsonb,
        ip_address text,
        user_agent text,
        occurred_at timestamptz not null default now()
      );
      create table damage_deposits (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id) on delete cascade,
        booking_id uuid not null references bookings(id) on delete cascade,
        occupant_id uuid not null references occupants(id) on delete cascade,
        amount integer not null check (amount > 0),
        method text not null,
        reference text,
        collected_at timestamptz not null default now(),
        status text not null default 'held'
          check (status in ('held', 'refunded', 'forfeited', 'partial_refund')),
        refund_amount integer,
        refund_reason text,
        resolved_at timestamptz,
        resolved_by uuid references auth.users(id),
        notes text,
        collected_by uuid references auth.users(id),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (booking_id)
      );

      alter table bookings
        add column room_assignment_source text not null default 'booking',
        add column room_assignment_locked boolean not null default false,
        add column room_assigned_by uuid references auth.users(id),
        add column room_assigned_at timestamptz not null default now();

      alter table booking_payments
        add column draft_file_path text,
        add column draft_bank_name text,
        add column draft_number text,
        add column draft_deposit_date date,
        add column draft_note text,
        add column rejected_reason text,
        add column rejected_by uuid references auth.users(id),
        add column rejected_at timestamptz,
        add column approved_by uuid references auth.users(id),
        add column approved_at timestamptz;

      create table tenant_daily_reports (
        tenant_id uuid not null references tenants(id) on delete cascade,
        report_date date not null,
        revenue_total bigint not null default 0,
        revenue_rooms bigint not null default 0,
        revenue_food bigint not null default 0,
        revenue_pos bigint not null default 0,
        revenue_walkin bigint not null default 0,
        revenue_deposits bigint not null default 0,
        rev_cash bigint not null default 0,
        rev_momo bigint not null default 0,
        rev_card bigint not null default 0,
        rev_bank bigint not null default 0,
        rev_online_other bigint not null default 0,
        outstanding_balance bigint not null default 0,
        primary key (tenant_id, report_date)
      );
      create function compute_daily_report(p_tenant_id uuid, p_date date default current_date)
      returns tenant_daily_reports language plpgsql security definer as $$
      declare v_result tenant_daily_reports;
      begin
        insert into tenant_daily_reports (tenant_id, report_date)
        values (p_tenant_id, p_date)
        on conflict (tenant_id, report_date) do update set
          revenue_total = 0,
          revenue_rooms = 0,
          revenue_food = 0,
          revenue_pos = 0,
          revenue_walkin = 0,
          revenue_deposits = 0,
          rev_cash = 0,
          rev_momo = 0,
          rev_card = 0,
          rev_bank = 0,
          rev_online_other = 0,
          outstanding_balance = 0;
        select * into v_result from tenant_daily_reports
         where tenant_id = p_tenant_id and report_date = p_date;
        return v_result;
      end;
      $$;
    `,
    extraMigrationFiles: [
      '20240001000143_booking_charge_journal_source.sql',
      '20240001000144_financial_reconciliation.sql',
      '20240001000145_canonical_financial_reporting.sql',
      '20240001000146_payment_idempotency_and_reconciliation.sql',
    ],
  })
  client = db.client

  await client.query(`insert into auth.users (id) values ($1)`, [actorId])
  await client.query(`insert into auth.users (id) values ($1)`, [extensionActorId])
  await client.query(
    `insert into tenants (id, name, slug) values ($1, 'Finance Test', $2)`,
    [tenantId, `finance-${tenantId.slice(0, 8)}`],
  )
  await client.query(
    `insert into chart_of_accounts (tenant_id, code, name, type) values
      ($1, '1010', 'Cash on Hand', 'asset'),
      ($1, '1020', 'Cash at Bank', 'asset'),
      ($1, '4010', 'Room Revenue', 'revenue'),
      ($1, '4020', 'Laundry Income', 'revenue'),
      ($1, '4030', 'Other Income', 'revenue'),
      ($1, '2300', 'Unearned Revenue', 'liability')`,
    [tenantId],
  )
  const categoryId = randomUUID()
  await client.query(
    `insert into room_categories (id, tenant_id, name, type, base_rate, capacity)
     values ($1, $2, 'Single', 'single', 100000, 1)`,
    [categoryId, tenantId],
  )
  await client.query(
    `insert into rooms (id, tenant_id, category_id, room_number)
     values ($1, $2, $3, 'F-01')`,
    [roomId, tenantId, categoryId],
  )
  await client.query(
    `insert into occupants (id, tenant_id, first_name, last_name, phone)
     values ($1, $2, 'Finance', 'Guest', '0244000000')`,
    [occupantId, tenantId],
  )
  await client.query(
    `insert into bookings (
       id, tenant_id, booking_ref, occupant_id, room_id, status, source,
       check_in_date, check_out_date, rate_per_unit, total_amount
     ) values (
       $1, $2, 'FIN-001', $3, $4, 'pending_payment', 'walk_in',
       current_date + 1, current_date + 30, 100000, 100000
     )`,
    [bookingId, tenantId, occupantId, roomId],
  )
}, 60_000)

afterAll(async () => {
  if (db) await db.teardown()
})

describe('financial reconciliation', () => {
  it('records one atomic receipt and rejects overpayment', async () => {
    const result = await client.query(
      `select record_booking_payment($1, $2, 60000, 'cash', null, 'Deposit', $3, false) as result`,
      [tenantId, bookingId, actorId],
    )
    expect(result.rows[0].result).toMatchObject({ amount: 60_000, balance: 40_000 })

    await expect(client.query(
      `select record_booking_payment($1, $2, 60000, 'cash', null, 'Retry', $3, true)`,
      [tenantId, bookingId, actorId],
    )).rejects.toThrow(/matching payment (was recorded|already exists)/i)

    await expect(client.query(
      `select record_booking_payment($1, $2, 50000, 'cash', null, null, $3, false)`,
      [tenantId, bookingId, actorId],
    )).rejects.toThrow(/exceeds the outstanding balance/i)

    const journals = await client.query(
      `select count(*)::int as count from journal_entries
        where source = 'booking_payment' and tenant_id = $1`,
      [tenantId],
    )
    expect(journals.rows[0].count).toBe(1)
  })

  it('includes paid and unpaid folio charges in the same invoice model', async () => {
    await client.query(
      `insert into booking_charges (
        tenant_id, booking_id, description, category, unit_price,
        payment_method, paid, created_by
      ) values
        ($1, $2, 'Laundry', 'laundry', 10000, 'cash', true, $3),
        ($1, $2, 'Parking', 'parking', 5000, null, false, $3)`,
      [tenantId, bookingId, actorId],
    )

    const finance = await client.query(
      `select * from booking_financials where booking_id = $1`,
      [bookingId],
    )
    expect(finance.rows[0]).toMatchObject({
      invoice_total: '115000',
      invoice_received: '70000',
      outstanding: '45000',
      derived_payment_status: 'partial',
    })
  })

  it('posts a linked reversal so ledger cash and revenue no longer retain it', async () => {
    const payment = await client.query(
      `select id from booking_payments where booking_id = $1 and amount = 60000`,
      [bookingId],
    )
    await client.query(`update booking_payments set status = 'reversed' where id = $1`, [payment.rows[0].id])

    const reversal = await client.query(
      `select count(*)::int as count
         from journal_entries
        where source = 'refund' and source_id = $1 and reverses_entry_id is not null`,
      [payment.rows[0].id],
    )
    expect(reversal.rows[0].count).toBe(1)

    const tb = await client.query(`select * from get_trial_balance($1, null, null)`, [tenantId])
    const cash = tb.rows.find((row) => row.code === '1010')
    expect(Number(cash.balance)).toBe(10_000)

    await expect(client.query(
      `update booking_payments set status = 'failed' where id = $1`,
      [payment.rows[0].id],
    )).rejects.toThrow(/reversed payment is terminal/i)

    await expect(client.query(
      `delete from booking_payments where id = $1`,
      [payment.rows[0].id],
    )).rejects.toThrow(/posted payment cannot be deleted/i)
  })

  it('uses one complete receipt definition for reports and daily close-out', async () => {
    const breakdown = await client.query(
      `select source, method, total_amount, transaction_count
         from get_booking_receipt_breakdown($1, now() - interval '1 day', now() + interval '1 day', null)`,
      [tenantId],
    )
    expect(breakdown.rows).toEqual([
      expect.objectContaining({
        source: 'booking_charge',
        method: 'cash',
        total_amount: '10000',
        transaction_count: '1',
      }),
    ])

    const daily = await client.query(
      `select (compute_daily_report($1, current_date)).*`,
      [tenantId],
    )
    expect(daily.rows[0]).toMatchObject({
      revenue_total: '10000',
      revenue_rooms: '10000',
      rev_cash: '10000',
      outstanding_balance: '105000',
    })

    const cashFlow = await client.query(
      `select * from get_cash_flow_by_source($1, current_date - 1, current_date + 1)`,
      [tenantId],
    )
    const folioCash = cashFlow.rows.find((row) => row.source === 'booking_charge')
    expect(folioCash).toMatchObject({ total_inflow: '10000', total_outflow: '0' })
  })

  it('extends the invoice and records split receipts atomically', async () => {
    const extensionBookingId = randomUUID()
    await client.query(
      `insert into bookings (
         id, tenant_id, booking_ref, occupant_id, room_id, status, source,
         check_in_date, check_out_date, rate_per_unit, rate_unit, total_amount
       ) values (
         $1, $2, 'FIN-EXTEND', $3, $4, 'confirmed', 'walk_in',
         current_date + 60, current_date + 61, 100000, 'night', 100000
       )`,
      [extensionBookingId, tenantId, occupantId, roomId],
    )

    const extended = await client.query(
      `select extend_booking_stay_with_payments(
         $1, $2, current_date + 63, null,
         '[{"method":"cash","amount":50000},{"method":"card","amount":150000}]'::jsonb,
         $3
       ) as result`,
      [tenantId, extensionBookingId, extensionActorId],
    )
    expect(extended.rows[0].result).toMatchObject({
      total_amount: 300_000,
      final_amount: 300_000,
      extra_amount: 200_000,
      paid_now: 200_000,
    })

    await expect(client.query(
      `select extend_booking_stay_with_payments(
         $1, $2, current_date + 64, null,
         '[{"method":"cash","amount":110000}]'::jsonb,
         $3
       )`,
      [tenantId, extensionBookingId, extensionActorId],
    )).rejects.toThrow(/exceeds the extension amount/i)

    const unchanged = await client.query(
      `select check_out_date::text, (current_date + 63)::text as expected_check_out,
              total_amount,
              (select count(*)::int from booking_payments where booking_id = $1) as payment_count
         from bookings where id = $1`,
      [extensionBookingId],
    )
    expect(unchanged.rows[0]).toMatchObject({
      total_amount: 300_000,
      payment_count: 2,
    })
    expect(unchanged.rows[0].check_out_date).toBe(unchanged.rows[0].expected_check_out)
  })

  it('undoes a bank-draft approval through a reversal and replacement', async () => {
    const draftId = randomUUID()
    await client.query(
      `insert into booking_payments (
         id, tenant_id, booking_id, amount, method, status,
         draft_file_path, draft_bank_name, draft_number
       ) values ($1, $2, $3, 20000, 'bank_draft', 'pending', 'drafts/test.pdf', 'Test Bank', 'D-1')`,
      [draftId, tenantId, bookingId],
    )
    await client.query(
      `update booking_payments
          set status = 'success', paid_at = now(), approved_at = now(), approved_by = $2
        where id = $1`,
      [draftId, actorId],
    )

    const undone = await client.query(
      `select undo_bank_draft_approval($1, $2, $3) as result`,
      [tenantId, draftId, actorId],
    )
    expect(undone.rows[0].result).toMatchObject({
      reversed_payment_id: draftId,
      status: 'pending',
    })

    const states = await client.query(
      `select status, count(*)::int as count
         from booking_payments
        where id in ($1, $2)
        group by status order by status`,
      [draftId, undone.rows[0].result.pending_payment_id],
    )
    expect(states.rows).toEqual([
      { status: 'pending', count: 1 },
      { status: 'reversed', count: 1 },
    ])
  })

  it('excludes journals voided in place from all ledger totals', async () => {
    const entryId = randomUUID()
    const cashAccount = await client.query(
      `select id from chart_of_accounts where tenant_id = $1 and code = '1010'`,
      [tenantId],
    )
    const revenueAccount = await client.query(
      `select id from chart_of_accounts where tenant_id = $1 and code = '4030'`,
      [tenantId],
    )
    await client.query(
      `insert into journal_entries (id, tenant_id, description, source, voided_at)
       values ($1, $2, 'Voided test', 'manual', now())`,
      [entryId, tenantId],
    )
    await client.query(
      `insert into journal_lines (entry_id, tenant_id, account_id, debit, credit) values
       ($1, $2, $3, 99000, 0), ($1, $2, $4, 0, 99000)`,
      [entryId, tenantId, cashAccount.rows[0].id, revenueAccount.rows[0].id],
    )

    const tb = await client.query(`select * from get_trial_balance($1, null, null)`, [tenantId])
    expect(Number(tb.rows.find((row) => row.code === '1010').balance)).toBe(60_000)
  })

  it('holds a late cancelled-booking receipt as a liability, not revenue', async () => {
    const cancelledBookingId = randomUUID()
    await client.query(
      `insert into bookings (
         id, tenant_id, booking_ref, occupant_id, room_id, status, source,
         check_in_date, check_out_date, rate_per_unit, total_amount
       ) values (
         $1, $2, 'FIN-CANCELLED', $3, $4, 'cancelled', 'website',
         current_date + 40, current_date + 41, 25000, 25000
       )`,
      [cancelledBookingId, tenantId, occupantId, roomId],
    )
    const finalized = await client.query(
      `select finalize_online_booking_payment(
         $1, $2, 25000, 'paystack-late-cancelled', 'card', 'Provider callback'
       ) as result`,
      [tenantId, cancelledBookingId],
    )
    expect(finalized.rows[0].result).toMatchObject({
      recorded: true,
      requires_resolution: true,
    })
    const paymentId = finalized.rows[0].result.payment_id

    const replayed = await client.query(
      `select finalize_online_booking_payment(
         $1, $2, 25000, 'paystack-late-cancelled', 'card', 'Duplicate callback'
       ) as result`,
      [tenantId, cancelledBookingId],
    )
    expect(replayed.rows[0].result).toMatchObject({
      recorded: false,
      payment_id: paymentId,
      requires_resolution: true,
    })

    const resolutionCase = await client.query(
      `select count(*)::int as count
         from booking_payment_exceptions
        where tenant_id = $1 and paystack_reference = 'paystack-late-cancelled'`,
      [tenantId],
    )
    expect(resolutionCase.rows[0].count).toBe(1)

    const posting = await client.query(
      `select coa.code, jl.debit, jl.credit
         from journal_entries je
         join journal_lines jl on jl.entry_id = je.id
         join chart_of_accounts coa on coa.id = jl.account_id
        where je.source = 'booking_payment' and je.source_id = $1
        order by coa.code`,
      [paymentId],
    )
    expect(posting.rows).toEqual([
      expect.objectContaining({ code: '1020', debit: 25000, credit: 0 }),
      expect.objectContaining({ code: '2300', debit: 0, credit: 25000 }),
    ])

    const summary = await client.query(
      `select get_booking_financial_summary($1) as summary`,
      [tenantId],
    )
    expect(Number(summary.rows[0].summary.unapplied_receipts)).toBeGreaterThanOrEqual(25_000)
    expect(Number(summary.rows[0].summary.mtd_received))
      .toBeGreaterThan(Number(summary.rows[0].summary.mtd_recognized))
  })

  it('reclassifies existing room and folio revenue when a paid booking is cancelled', async () => {
    const activeBookingId = randomUUID()
    await client.query(
      `insert into bookings (
         id, tenant_id, booking_ref, occupant_id, room_id, status, source,
         check_in_date, check_out_date, rate_per_unit, total_amount
       ) values (
         $1, $2, 'FIN-PAID-CANCEL', $3, $4, 'confirmed', 'walk_in',
         current_date + 50, current_date + 51, 30000, 30000
       )`,
      [activeBookingId, tenantId, occupantId, roomId],
    )
    const paymentId = randomUUID()
    await client.query(
      `insert into booking_payments (
         id, tenant_id, booking_id, amount, method, status, paid_at
       ) values ($1, $2, $3, 30000, 'cash', 'success', now())`,
      [paymentId, tenantId, activeBookingId],
    )
    const chargeId = randomUUID()
    await client.query(
      `insert into booking_charges (
         id, tenant_id, booking_id, description, category, unit_price,
         payment_method, paid, created_by
       ) values ($1, $2, $3, 'Laundry', 'laundry', 5000, 'cash', true, $4)`,
      [chargeId, tenantId, activeBookingId, actorId],
    )

    await client.query(`update bookings set status = 'cancelled' where id = $1`, [activeBookingId])

    const reclasses = await client.query(
      `select source, source_id, description
         from journal_entries
        where tenant_id = $1
          and source_id in ($2, $3)
          and description like 'Cancelled booking%reclassified for resolution'`,
      [tenantId, paymentId, chargeId],
    )
    expect(reclasses.rows).toHaveLength(2)

    const tb = await client.query(`select * from get_trial_balance($1, null, null)`, [tenantId])
    const liability = tb.rows.find((row) => row.code === '2300')
    expect(Number(liability.balance)).toBeGreaterThanOrEqual(60_000)
  })

  it('treats refundable deposits as liabilities and only forfeitures as revenue', async () => {
    const depositId = randomUUID()
    await client.query(
      `insert into damage_deposits (
         id, tenant_id, booking_id, occupant_id, amount, method, collected_by
       ) values ($1, $2, $3, $4, 12000, 'cash', $5)`,
      [depositId, tenantId, bookingId, occupantId, actorId],
    )

    await client.query(
      `update damage_deposits
          set status = 'partial_refund', refund_amount = 7000,
              resolved_at = now(), resolved_by = $2
        where id = $1`,
      [depositId, actorId],
    )

    const lines = await client.query(
      `select coa.code, sum(jl.debit)::int as debit, sum(jl.credit)::int as credit
         from journal_entries je
         join journal_lines jl on jl.entry_id = je.id
         join chart_of_accounts coa on coa.id = jl.account_id
        where je.source = 'damage_deposit' and je.source_id = $1
        group by coa.code
        order by coa.code`,
      [depositId],
    )
    expect(lines.rows).toEqual([
      { code: '1010', debit: 12000, credit: 7000 },
      { code: '2300', debit: 12000, credit: 12000 },
      { code: '4030', debit: 0, credit: 5000 },
    ])

    const shift = await client.query(
      `select get_staff_shift_financials($1, $2, current_date) as totals`,
      [tenantId, actorId],
    )
    expect(shift.rows[0].totals).toMatchObject({
      system_cash: 20_000,
      system_digital: 0,
      cash_activity_count: 4,
      booking_receipts: 15_000,
      deposits_collected: 12_000,
      deposits_refunded: 7_000,
    })

    const integrity = await client.query(
      `select get_financial_integrity_summary($1) as summary`,
      [tenantId],
    )
    expect(integrity.rows[0].summary).toMatchObject({
      payment_journal_gaps: 0,
      charge_journal_gaps: 0,
      deposit_journal_gaps: 0,
      unbalanced_journals: 0,
      cross_tenant_journal_lines: 0,
      booking_balance_mismatches: 0,
      cancelled_revenue_exposure: 0,
      deposit_liability_mismatches: 0,
      total_issues: 0,
    })

    const recognized = await client.query(
      `select coalesce(sum(total_amount), 0)::int as total
         from get_booking_revenue_breakdown(
           $1, now() - interval '1 day', now() + interval '1 day'
         )`,
      [tenantId],
    )
    expect(recognized.rows[0].total).toBe(210_000)

    const grouped = await client.query(
      `select * from get_booking_revenue_report(
         $1, current_date - 1, current_date + 1, 'payment_method'
       )`,
      [tenantId],
    )
    expect(grouped.rows.reduce((sum, row) => sum + Number(row.total_amount), 0)).toBe(210_000)

    const aging = await client.query(
      `select id, outstanding from get_booking_aging_rows($1, null, null)`,
      [tenantId],
    )
    expect(aging.rows).toHaveLength(2)
    expect(aging.rows.reduce((sum, row) => sum + Number(row.outstanding), 0)).toBe(205_000)
  })

  it('settles a provider-created pending receipt atomically and confirms the booking once', async () => {
    const pendingBookingId = randomUUID()
    const pendingPaymentId = randomUUID()
    await client.query(
      `insert into bookings (
         id, tenant_id, booking_ref, occupant_id, room_id, status, source,
         check_in_date, check_out_date, rate_per_unit, total_amount
       ) values (
         $1, $2, 'FIN-PENDING-WEBHOOK', $3, $4, 'pending_payment', 'website',
         current_date + 100, current_date + 101, 25000, 25000
       )`,
      [pendingBookingId, tenantId, occupantId, roomId],
    )
    await client.query(
      `insert into booking_payments (
         id, tenant_id, booking_id, amount, method, status, reference
       ) values ($1, $2, $3, 25000, 'momo_mtn', 'pending', 'abr-pending')`,
      [pendingPaymentId, tenantId, pendingBookingId],
    )

    const settled = await client.query(
      `select finalize_pending_booking_payment(
         $1, $2, 'paystack-provider-ref', now()
       ) as result`,
      [tenantId, pendingPaymentId],
    )
    expect(settled.rows[0].result).toMatchObject({
      recorded: true,
      payment_id: pendingPaymentId,
      booking_id: pendingBookingId,
      amount: 25_000,
      requires_resolution: false,
    })

    const booking = await client.query(
      `select status, paid_amount, payment_status from bookings where id = $1`,
      [pendingBookingId],
    )
    expect(booking.rows[0]).toMatchObject({
      status: 'confirmed',
      paid_amount: 25_000,
      payment_status: 'paid',
    })

    const replayed = await client.query(
      `select finalize_pending_booking_payment(
         $1, $2, 'paystack-provider-ref', now()
       ) as result`,
      [tenantId, pendingPaymentId],
    )
    expect(replayed.rows[0].result).toMatchObject({ recorded: false })

    const journals = await client.query(
      `select count(*)::int as count
         from journal_entries
        where tenant_id = $1 and source = 'booking_payment' and source_id = $2`,
      [tenantId, pendingPaymentId],
    )
    expect(journals.rows[0].count).toBe(1)
  })

  it('posts a later cancellation in the current period without rewriting original revenue', async () => {
    const historicalBookingId = randomUUID()
    const historicalPaymentId = randomUUID()
    await client.query(
      `insert into bookings (
         id, tenant_id, booking_ref, occupant_id, room_id, status, source,
         check_in_date, check_out_date, rate_per_unit, total_amount
       ) values (
         $1, $2, 'FIN-HISTORICAL-CANCEL', $3, $4, 'confirmed', 'walk_in',
         current_date + 120, current_date + 121, 10000, 10000
       )`,
      [historicalBookingId, tenantId, occupantId, roomId],
    )
    await client.query(
      `insert into booking_payments (
         id, tenant_id, booking_id, amount, method, status, paid_at
       ) values ($1, $2, $3, 10000, 'cash', 'success', now() - interval '40 days')`,
      [historicalPaymentId, tenantId, historicalBookingId],
    )

    await client.query(`update bookings set status = 'cancelled' where id = $1`, [historicalBookingId])

    const postings = await client.query(
      `select description, entry_date::text, current_date::text as today
         from journal_entries
        where tenant_id = $1 and source_id = $2
        order by created_at`,
      [tenantId, historicalPaymentId],
    )
    expect(postings.rows).toEqual([
      expect.objectContaining({ description: 'Room payment received' }),
      expect.objectContaining({
        description: 'Cancelled booking receipt reclassified for resolution',
        entry_date: postings.rows[0].today,
      }),
    ])
    expect(postings.rows[0].entry_date).not.toBe(postings.rows[1].entry_date)

    const originalPeriod = await client.query(
      `select coalesce(sum(total_amount), 0)::int as amount
         from get_booking_revenue_breakdown(
           $1, now() - interval '41 days', now() - interval '39 days'
         )`,
      [tenantId],
    )
    const adjustmentPeriod = await client.query(
      `select coalesce(sum(total_amount), 0)::int as amount
         from get_booking_revenue_breakdown(
           $1,
           current_date::timestamp at time zone 'Africa/Accra',
           (current_date + 1)::timestamp at time zone 'Africa/Accra'
         )`,
      [tenantId],
    )
    expect(originalPeriod.rows[0].amount).toBe(10_000)
    expect(adjustmentPeriod.rows[0].amount).toBe(225_000)

    const canonicalTotals = await client.query(
      `select get_booking_financial_summary($1) as summary,
              get_platform_booking_revenue_total($1)::int as platform_total`,
      [tenantId],
    )
    expect(canonicalTotals.rows[0].summary.mtd_recognized).toBe(225_000)
    expect(canonicalTotals.rows[0].platform_total).toBe(235_000)
  })

  it('makes manual payment retries idempotent and rejects fresh duplicate attempts', async () => {
    const retryBookingId = randomUUID()
    const idempotencyKey = randomUUID()
    await client.query(
      `insert into bookings (
         id, tenant_id, booking_ref, occupant_id, room_id, status, source,
         check_in_date, check_out_date, rate_per_unit, total_amount
       ) values (
         $1, $2, 'FIN-IDEM', $3, $4, 'pending_payment', 'walk_in',
         current_date + 40, current_date + 70, 200000, 200000
       )`,
      [retryBookingId, tenantId, occupantId, roomId],
    )

    const first = await client.query(
      `select record_booking_payment_idempotent(
         $1, $2, 80000, 'momo_mtn', null, 'First request', $3, false, $4
       ) as result`,
      [tenantId, retryBookingId, actorId, idempotencyKey],
    )
    const retry = await client.query(
      `select record_booking_payment_idempotent(
         $1, $2, 80000, 'momo_mtn', null, 'Transport retry', $3, false, $4
       ) as result`,
      [tenantId, retryBookingId, actorId, idempotencyKey],
    )

    expect(first.rows[0].result).toMatchObject({ recorded: true, idempotent: true })
    expect(retry.rows[0].result).toMatchObject({
      id: first.rows[0].result.id,
      recorded: false,
      idempotent: true,
    })

    await expect(client.query(
      `select record_booking_payment_idempotent(
         $1, $2, 80000, 'momo_mtn', null, 'Fresh duplicate', $3, false, $4
       )`,
      [tenantId, retryBookingId, actorId, randomUUID()],
    )).rejects.toThrow(/matching payment already exists/i)

    // The table trigger/index must protect direct and future writer paths too,
    // not only callers that remember to use the canonical RPC.
    await expect(client.query(
      `insert into booking_payments (
         tenant_id, booking_id, amount, method, status, paid_at, received_by
       ) values ($1, $2, 80000, 'momo_mtn', 'success', now(), $3)`,
      [tenantId, retryBookingId, actorId],
    )).rejects.toThrow(/matching unreferenced payment already exists/i)

    const genuineSecond = await client.query(
      `select record_booking_payment_idempotent(
         $1, $2, 80000, 'momo_mtn', 'MOMO-SECOND-001', 'Separate transfer', $3, false, $4
       ) as result`,
      [tenantId, retryBookingId, actorId, randomUUID()],
    )
    expect(genuineSecond.rows[0].result.recorded).toBe(true)

    const count = await client.query(
      `select count(*)::int as count
         from booking_payments
        where booking_id = $1 and status = 'success'`,
      [retryBookingId],
    )
    expect(count.rows[0].count).toBe(2)
  })

  it('traces unapplied receipts to their exact booking and reason', async () => {
    const cancelledBookingId = randomUUID()
    await client.query(
      `insert into bookings (
         id, tenant_id, booking_ref, occupant_id, room_id, status, source,
         check_in_date, check_out_date, rate_per_unit, total_amount
       ) values (
         $1, $2, 'FIN-HELD', $3, $4, 'cancelled', 'walk_in',
         current_date + 80, current_date + 90, 29000, 29000
       )`,
      [cancelledBookingId, tenantId, occupantId, roomId],
    )
    await client.query(
      `insert into booking_payments (
         tenant_id, booking_id, amount, method, reference, status, paid_at, received_by
       ) values ($1, $2, 29000, 'cash', 'HELD-29000', 'success', now(), $3)`,
      [tenantId, cancelledBookingId, actorId],
    )

    const result = await client.query(
      `select * from get_unapplied_booking_receipts($1) where booking_id = $2`,
      [tenantId, cancelledBookingId],
    )
    expect(result.rows[0]).toMatchObject({
      booking_ref: 'FIN-HELD',
      booking_status: 'cancelled',
      total_receipts: '29000',
      invoice_received: '0',
      unapplied_amount: '29000',
      reason: 'cancelled_booking_receipt',
    })
  })
})
