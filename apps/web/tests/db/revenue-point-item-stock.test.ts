/**
 * Integration test for migration 137 (revenue_point_items stock tracking)
 * — a sale decrements stock_qty via the new trigger, a restock (simulated
 * directly at the SQL level, mirroring what the restock API route does)
 * increments it and logs an inventory_movements row, and stock never goes
 * negative even when oversold.
 *
 * The real revenue_points/revenue_point_items/revenue_point_sales tables
 * (migration 053) carry an unrelated auto-journal trigger requiring the
 * full accounting migration chain (chart_of_accounts ← ... ← payroll_runs
 * ← ...), several layers deeper than anything this stock feature actually
 * touches. Rather than drag that whole chain in just to satisfy an
 * unrelated trigger, this test hand-creates minimal stand-in tables
 * (matching the exact names/columns/constraint-naming migration 137's own
 * ALTER statements expect) via `beforeExtraMigrations`, then replays
 * migration 137's real SQL against them via `extraMigrationFiles` — so
 * the ALTER/trigger logic under test is the genuine migration file, not a
 * reimplementation.
 */
import { randomUUID } from 'node:crypto'

import type { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { startTestDb, type TestDb } from './harness'

let db: TestDb
let client: Client

async function createTenant(): Promise<string> {
  const id = randomUUID()
  await client.query(`insert into tenants (id, name, slug) values ($1, 'Test Hostel', $2)`, [
    id,
    `test-hostel-${id.slice(0, 8)}`,
  ])
  return id
}

async function createRevenuePoint(tenantId: string): Promise<string> {
  const id = randomUUID()
  await client.query(
    `insert into revenue_points (id, tenant_id, name, type) values ($1, $2, 'Mini Mart', 'mini_mart')`,
    [id, tenantId],
  )
  return id
}

async function createItem(tenantId: string, pointId: string, stockQty: number | null, reorderPoint = 0): Promise<string> {
  const id = randomUUID()
  await client.query(
    `insert into revenue_point_items (id, tenant_id, revenue_point_id, name, unit_price, stock_qty, reorder_point)
     values ($1, $2, $3, 'Bottled Water', 300, $4, $5)`,
    [id, tenantId, pointId, stockQty, reorderPoint],
  )
  return id
}

async function sell(tenantId: string, pointId: string, itemId: string, quantity: number) {
  await client.query(
    `insert into revenue_point_sales (tenant_id, revenue_point_id, item_id, description, quantity, unit_price, total_amount, payment_method)
     values ($1, $2, $3, 'Bottled Water', $4, 300, $5, 'cash')`,
    [tenantId, pointId, itemId, quantity, quantity * 300],
  )
}

const MINIMAL_SCHEMA = `
  create table revenue_points (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants(id) on delete cascade,
    name text not null,
    type text not null
  );

  create table revenue_point_items (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants(id) on delete cascade,
    revenue_point_id uuid not null references revenue_points(id) on delete cascade,
    name text not null,
    unit_price integer not null,
    unit text not null default 'item'
  );

  create table revenue_point_sales (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants(id) on delete cascade,
    revenue_point_id uuid not null references revenue_points(id),
    item_id uuid references revenue_point_items(id),
    description text not null,
    quantity numeric(10,2) not null default 1,
    unit_price integer not null,
    total_amount integer not null,
    payment_method text not null default 'cash',
    sold_by uuid,
    sold_at timestamptz not null default now(),
    created_at timestamptz not null default now()
  );

  create type inventory_movement_type as enum ('purchase', 'usage', 'adjustment', 'transfer');

  create table inventory_items (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants(id) on delete cascade,
    name text not null
  );

  create table inventory_movements (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants(id) on delete cascade,
    item_id uuid not null references inventory_items(id) on delete cascade,
    movement_type inventory_movement_type not null,
    quantity integer not null check (quantity <> 0),
    unit_cost integer not null default 0,
    reference text,
    notes text,
    moved_at date not null default current_date,
    created_by uuid,
    created_at timestamptz not null default now()
  );
`

beforeAll(async () => {
  db = await startTestDb({
    beforeExtraMigrations: MINIMAL_SCHEMA,
    extraMigrationFiles: ['20240001000137_revenue_point_item_stock.sql'],
  })
  client = db.client
}, 60_000)

afterAll(async () => {
  await db.teardown()
})

describe('revenue_point_items stock tracking', () => {
  it('leaves stock_qty untouched for a non-stock-tracked item', async () => {
    const tenantId = await createTenant()
    const pointId = await createRevenuePoint(tenantId)
    const itemId = await createItem(tenantId, pointId, null)

    await sell(tenantId, pointId, itemId, 2)

    const row = await client.query(`select stock_qty from revenue_point_items where id = $1`, [itemId])
    expect(row.rows[0].stock_qty).toBeNull()
  })

  it('decrements stock_qty by the sale quantity', async () => {
    const tenantId = await createTenant()
    const pointId = await createRevenuePoint(tenantId)
    const itemId = await createItem(tenantId, pointId, 20)

    await sell(tenantId, pointId, itemId, 3)

    const row = await client.query(`select stock_qty from revenue_point_items where id = $1`, [itemId])
    expect(row.rows[0].stock_qty).toBe(17)
  })

  it('logs an inventory_movements row for the sale', async () => {
    const tenantId = await createTenant()
    const pointId = await createRevenuePoint(tenantId)
    const itemId = await createItem(tenantId, pointId, 10)

    await sell(tenantId, pointId, itemId, 4)

    const rows = await client.query(
      `select movement_type, quantity from inventory_movements where item_id = $1`,
      [itemId],
    )
    expect(rows.rows).toHaveLength(1)
    expect(rows.rows[0].movement_type).toBe('usage')
    expect(rows.rows[0].quantity).toBe(-4)
  })

  it('clamps stock_qty at 0 rather than going negative when oversold', async () => {
    const tenantId = await createTenant()
    const pointId = await createRevenuePoint(tenantId)
    const itemId = await createItem(tenantId, pointId, 2)

    await sell(tenantId, pointId, itemId, 5)

    const row = await client.query(`select stock_qty from revenue_point_items where id = $1`, [itemId])
    expect(row.rows[0].stock_qty).toBe(0)
  })

  it('a restock (direct update + movement insert, matching the API route) increments stock_qty and is auditable', async () => {
    const tenantId = await createTenant()
    const pointId = await createRevenuePoint(tenantId)
    const itemId = await createItem(tenantId, pointId, 5)

    await client.query(`update revenue_point_items set stock_qty = stock_qty + 10 where id = $1`, [itemId])
    await client.query(
      `insert into inventory_movements (tenant_id, item_id, movement_type, quantity) values ($1, $2, 'purchase', 10)`,
      [tenantId, itemId],
    )

    const row = await client.query(`select stock_qty from revenue_point_items where id = $1`, [itemId])
    expect(row.rows[0].stock_qty).toBe(15)

    const movements = await client.query(
      `select movement_type, quantity from inventory_movements where item_id = $1 order by created_at`,
      [itemId],
    )
    expect(movements.rows).toHaveLength(1)
    expect(movements.rows[0]).toMatchObject({ movement_type: 'purchase', quantity: 10 })
  })
})
