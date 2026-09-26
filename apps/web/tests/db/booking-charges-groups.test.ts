/**
 * Integration tests for migrations 128/129 (booking_charges, booking_groups)
 * — the two hotel-only gaps ported from AMP Lodge. Covers the fixed
 * category check constraint and tenant-isolation RLS, mirroring the
 * baseline pattern in tests/db/rls.test.ts.
 */
import { randomUUID } from 'node:crypto'

import type { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { startTestDb, type TestDb } from './harness'

let db: TestDb
let client: Client

async function createTenant(name: string): Promise<string> {
  const id = randomUUID()
  await client.query(
    `insert into tenants (id, name, slug, status) values ($1, $2, $3, 'active')`,
    [id, name, name.toLowerCase().replace(/\s+/g, '-') + '-' + id.slice(0, 8)],
  )
  return id
}

async function createMember(tenantId: string, role: string): Promise<string> {
  const userId = randomUUID()
  await client.query(`insert into auth.users (id) values ($1)`, [userId])
  await client.query(
    `insert into tenant_members (id, tenant_id, user_id, role, is_active) values ($1, $2, $3, $4, true)`,
    [randomUUID(), tenantId, userId, role],
  )
  return userId
}

async function createBookingFixture(tenantId: string, userId: string): Promise<string> {
  const categoryId = randomUUID()
  await client.query(
    `insert into room_categories (id, tenant_id, name, type, base_rate) values ($1, $2, 'Standard', 'single', 10000)`,
    [categoryId, tenantId],
  )
  const roomId = randomUUID()
  await client.query(
    `insert into rooms (id, tenant_id, category_id, room_number, block) values ($1, $2, $3, '101', '')`,
    [roomId, tenantId, categoryId],
  )
  const occupantId = randomUUID()
  await client.query(
    `insert into occupants (id, tenant_id, first_name, last_name, phone) values ($1, $2, 'Test', 'Guest', '0200000000')`,
    [occupantId, tenantId],
  )
  const bookingId = randomUUID()
  await client.query(
    `insert into bookings (id, tenant_id, booking_ref, occupant_id, room_id, check_in_date, check_out_date, rate_per_unit, rate_unit, total_amount, created_by)
     values ($1, $2, $3, $4, $5, '2026-01-01', '2026-01-02', 10000, 'night', 10000, $6)`,
    [bookingId, tenantId, `TEST-${bookingId.slice(0, 8)}`, occupantId, roomId, userId],
  )
  return bookingId
}

beforeAll(async () => {
  db = await startTestDb({
    extraMigrationFiles: [
      '20240001000128_booking_charges.sql',
      '20240001000129_booking_groups.sql',
    ],
  })
  client = db.client
}, 60_000)

afterAll(async () => {
  await db.teardown()
})

describe('booking_charges', () => {
  it('accepts a valid category', async () => {
    const tenantId = await createTenant('Tenant A')
    const userId = await createMember(tenantId, 'owner')
    const bookingId = await createBookingFixture(tenantId, userId)

    const id = randomUUID()
    await client.query(
      `insert into booking_charges (id, tenant_id, booking_id, description, category, unit_price, created_by)
       values ($1, $2, $3, 'Minibar snack', 'minibar', 500, $4)`,
      [id, tenantId, bookingId, userId],
    )
    const row = await client.query(`select amount, category from booking_charges where id = $1`, [id])
    expect(row.rows[0].category).toBe('minibar')
    expect(Number(row.rows[0].amount)).toBe(500) // quantity defaults to 1
  })

  it('rejects a category outside the fixed list', async () => {
    const tenantId = await createTenant('Tenant B')
    const userId = await createMember(tenantId, 'owner')
    const bookingId = await createBookingFixture(tenantId, userId)

    await expect(
      client.query(
        `insert into booking_charges (id, tenant_id, booking_id, description, category, unit_price, created_by)
         values ($1, $2, $3, 'Mystery item', 'spa_treatment', 500, $4)`,
        [randomUUID(), tenantId, bookingId, userId],
      ),
    ).rejects.toThrow(/check constraint/i)
  })

  it('computes amount as quantity × unit_price', async () => {
    const tenantId = await createTenant('Tenant C')
    const userId = await createMember(tenantId, 'owner')
    const bookingId = await createBookingFixture(tenantId, userId)

    const id = randomUUID()
    await client.query(
      `insert into booking_charges (id, tenant_id, booking_id, description, category, quantity, unit_price, created_by)
       values ($1, $2, $3, 'Laundry', 'laundry', 3, 400, $4)`,
      [id, tenantId, bookingId, userId],
    )
    const row = await client.query(`select amount from booking_charges where id = $1`, [id])
    expect(Number(row.rows[0].amount)).toBe(1200)
  })

  it('does not let a tenant B member read tenant A\'s booking charges', async () => {
    const tenantA = await createTenant('Tenant D')
    const ownerA = await createMember(tenantA, 'owner')
    const bookingA = await createBookingFixture(tenantA, ownerA)
    await client.query(
      `insert into booking_charges (id, tenant_id, booking_id, description, category, unit_price, created_by)
       values ($1, $2, $3, 'Room service', 'room_service', 1500, $4)`,
      [randomUUID(), tenantA, bookingA, ownerA],
    )

    const tenantB = await createTenant('Tenant E')
    const ownerB = await createMember(tenantB, 'owner')

    await db.asUser({ sub: ownerB, role: 'authenticated' }, async (c) => {
      const visible = await c.query(`select * from booking_charges where tenant_id = $1`, [tenantA])
      expect(visible.rows.length).toBe(0)
    })
  })
})

describe('booking_groups', () => {
  it('links member bookings via bookings.group_id', async () => {
    const tenantId = await createTenant('Tenant F')
    const userId = await createMember(tenantId, 'owner')

    const groupId = randomUUID()
    await client.query(
      `insert into booking_groups (id, tenant_id, group_ref, billing_contact_name, created_by)
       values ($1, $2, 'GRP-2026-TEST', 'Group Organizer', $3)`,
      [groupId, tenantId, userId],
    )

    const bookingId = await createBookingFixture(tenantId, userId)
    await client.query(`update bookings set group_id = $1 where id = $2`, [groupId, bookingId])

    const row = await client.query(`select group_id from bookings where id = $1`, [bookingId])
    expect(row.rows[0].group_id).toBe(groupId)
  })

  it('rejects a duplicate group_ref within the same tenant', async () => {
    const tenantId = await createTenant('Tenant G')
    const userId = await createMember(tenantId, 'owner')

    await client.query(
      `insert into booking_groups (id, tenant_id, group_ref, created_by) values ($1, $2, 'GRP-2026-DUP', $3)`,
      [randomUUID(), tenantId, userId],
    )
    await expect(
      client.query(
        `insert into booking_groups (id, tenant_id, group_ref, created_by) values ($1, $2, 'GRP-2026-DUP', $3)`,
        [randomUUID(), tenantId, userId],
      ),
    ).rejects.toThrow(/duplicate key/i)
  })

  it('does not let a tenant B member read tenant A\'s booking groups', async () => {
    const tenantA = await createTenant('Tenant H')
    const ownerA = await createMember(tenantA, 'owner')
    await client.query(
      `insert into booking_groups (id, tenant_id, group_ref, created_by) values ($1, $2, 'GRP-2026-ISOL', $3)`,
      [randomUUID(), tenantA, ownerA],
    )

    const tenantB = await createTenant('Tenant I')
    const ownerB = await createMember(tenantB, 'owner')

    await db.asUser({ sub: ownerB, role: 'authenticated' }, async (c) => {
      const visible = await c.query(`select * from booking_groups where tenant_id = $1`, [tenantA])
      expect(visible.rows.length).toBe(0)
    })
  })
})
