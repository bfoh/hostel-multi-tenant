/**
 * Integration tests for the minimal post-trial dashboard's RLS boundary
 * (migration 120): a tenant whose trial lapsed without subscribing
 * (status='trial_expired') keeps room-price editing and read access to
 * bookings, but loses the ability to create/modify/cancel bookings. 'trial'
 * and 'active' tenants keep full access to both.
 *
 * Applies migrations 118-120 on top of the base RLS harness (see
 * tests/db/harness.ts for why the base list stops at 116/117) since those
 * three migrations only add columns/policies to tables the base list
 * already establishes (tenants, room_categories, rooms, occupants, bookings).
 */
import { randomUUID } from 'node:crypto'

import type { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { startTestDb, type TestDb } from './harness'

let db: TestDb
let client: Client

async function createTenant(status: string): Promise<string> {
  const id = randomUUID()
  await client.query(
    `insert into tenants (id, name, slug, status) values ($1, $2, $3, $4)`,
    [id, `Tenant ${status}`, `tenant-${status}-${id.slice(0, 8)}`, status],
  )
  return id
}

async function createOwner(tenantId: string): Promise<string> {
  const userId = randomUUID()
  await client.query(`insert into auth.users (id) values ($1)`, [userId])
  await client.query(
    `insert into tenant_members (id, tenant_id, user_id, role, is_active) values ($1, $2, $3, 'owner', true)`,
    [randomUUID(), tenantId, userId],
  )
  return userId
}

async function createRoomAndOccupant(tenantId: string): Promise<{ roomId: string; occupantId: string }> {
  const categoryId = randomUUID()
  await client.query(
    `insert into room_categories (id, tenant_id, name, type, base_rate) values ($1, $2, 'Single', 'single', 100000)`,
    [categoryId, tenantId],
  )
  const roomId = randomUUID()
  await client.query(
    `insert into rooms (id, tenant_id, category_id, room_number) values ($1, $2, $3, '101')`,
    [roomId, tenantId, categoryId],
  )
  const occupantId = randomUUID()
  await client.query(
    `insert into occupants (id, tenant_id, first_name, last_name, phone) values ($1, $2, 'Ama', 'Mensah', '0244000000')`,
    [occupantId, tenantId],
  )
  return { roomId, occupantId }
}

beforeAll(async () => {
  db = await startTestDb({
    extraMigrationFiles: [
      '20240001000004_tenant_contact_fields.sql', // adds tenants.address_city, indexed by 119
      '20240001000118_tenant_status_trial_expired.sql',
      '20240001000119_public_marketplace_columns.sql',
      '20240001000120_trial_expired_bookings_access.sql',
    ],
  })
  client = db.client
}, 60_000)

afterAll(async () => {
  await db.teardown()
})

describe('trial_expired: room price editing stays open', () => {
  it('lets the owner update room_categories.base_rate', async () => {
    const tenantId = await createTenant('trial_expired')
    const ownerId = await createOwner(tenantId)
    const { } = await createRoomAndOccupant(tenantId)
    const categoryId = (
      await client.query(`select id from room_categories where tenant_id = $1`, [tenantId])
    ).rows[0].id

    await db.asUser(
      { sub: ownerId, role: 'authenticated', tenant_id: tenantId, tenant_role: 'owner' },
      async (c) => {
        await c.query(`update room_categories set base_rate = 150000 where id = $1`, [categoryId])
      },
      { commit: true },
    )

    const row = await client.query(`select base_rate from room_categories where id = $1`, [categoryId])
    expect(row.rows[0].base_rate).toBe(150000)
  })
})

describe('trial_expired: booking mutations are blocked', () => {
  it('blocks the owner from creating a new booking', async () => {
    const tenantId = await createTenant('trial_expired')
    const ownerId = await createOwner(tenantId)
    const { roomId, occupantId } = await createRoomAndOccupant(tenantId)

    await expect(
      db.asUser(
        { sub: ownerId, role: 'authenticated', tenant_id: tenantId, tenant_role: 'owner' },
        async (c) => {
          await c.query(
            `insert into bookings
               (id, tenant_id, booking_ref, occupant_id, room_id, check_in_date, check_out_date, rate_per_unit, total_amount)
             values ($1, $2, 'ABR-TEST-001', $3, $4, current_date, current_date + 30, 100000, 100000)`,
            [randomUUID(), tenantId, occupantId, roomId],
          )
        },
      ),
    ).rejects.toThrow(/row-level security/i)

    const stillNone = await client.query(`select 1 from bookings where tenant_id = $1`, [tenantId])
    expect(stillNone.rowCount).toBe(0)
  })
})

describe('trial / active: booking mutations stay allowed', () => {
  it.each(['trial', 'active'])('lets the owner create a new booking when status=%s', async (status) => {
    const tenantId = await createTenant(status)
    const ownerId = await createOwner(tenantId)
    const { roomId, occupantId } = await createRoomAndOccupant(tenantId)
    const bookingId = randomUUID()

    await db.asUser(
      { sub: ownerId, role: 'authenticated', tenant_id: tenantId, tenant_role: 'owner' },
      async (c) => {
        await c.query(
          `insert into bookings
             (id, tenant_id, booking_ref, occupant_id, room_id, check_in_date, check_out_date, rate_per_unit, total_amount)
           values ($1, $2, 'ABR-TEST-002', $3, $4, current_date, current_date + 30, 100000, 100000)`,
          [bookingId, tenantId, occupantId, roomId],
        )
      },
      { commit: true },
    )

    const row = await client.query(`select 1 from bookings where id = $1`, [bookingId])
    expect(row.rowCount).toBe(1)
  })
})
