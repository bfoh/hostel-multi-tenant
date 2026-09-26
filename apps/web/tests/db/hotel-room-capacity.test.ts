/**
 * Integration test for migration 130 (hotel room capacity) — proves the
 * enforce_room_capacity() trigger forces effective capacity to 1 for hotel
 * tenants (a room sells as one unit per stay) while leaving hostel
 * multi-occupancy (migration 101's original behavior) completely
 * unaffected.
 */
import { randomUUID } from 'node:crypto'

import type { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { startTestDb, type TestDb } from './harness'

let db: TestDb
let client: Client

async function createTenant(businessType: 'hostel' | 'hotel'): Promise<string> {
  const id = randomUUID()
  await client.query(
    `insert into tenants (id, name, slug, status, business_type) values ($1, $2, $3, 'active', $4)`,
    [id, `Test ${businessType}`, `test-${businessType}-${id.slice(0, 8)}`, businessType],
  )
  return id
}

async function createRoomWithCapacity(tenantId: string, capacity: number): Promise<string> {
  const categoryId = randomUUID()
  await client.query(
    `insert into room_categories (id, tenant_id, name, type, base_rate, capacity) values ($1, $2, 'Standard', 'double', 10000, $3)`,
    [categoryId, tenantId, capacity],
  )
  const roomId = randomUUID()
  await client.query(
    `insert into rooms (id, tenant_id, category_id, room_number, block) values ($1, $2, $3, '101', '')`,
    [roomId, tenantId, categoryId],
  )
  return roomId
}

async function createOccupant(tenantId: string): Promise<string> {
  const occupantId = randomUUID()
  await client.query(
    `insert into occupants (id, tenant_id, first_name, last_name, phone) values ($1, $2, 'Test', 'Guest', '0200000000')`,
    [occupantId, tenantId],
  )
  return occupantId
}

async function insertBooking(tenantId: string, roomId: string, occupantId: string, checkIn: string, checkOut: string) {
  const id = randomUUID()
  await client.query(
    `insert into bookings (id, tenant_id, booking_ref, occupant_id, room_id, check_in_date, check_out_date, rate_per_unit, rate_unit, total_amount, status)
     values ($1, $2, $3, $4, $5, $6, $7, 10000, 'night', 10000, 'confirmed')`,
    [id, tenantId, `TEST-${id.slice(0, 8)}`, occupantId, roomId, checkIn, checkOut],
  )
  return id
}

beforeAll(async () => {
  db = await startTestDb({
    extraMigrationFiles: [
      '20240001000004_tenant_contact_fields.sql',
      '20240001000101_capacity_aware_bookings.sql',
      '20240001000118_tenant_status_trial_expired.sql',
      '20240001000119_public_marketplace_columns.sql',
      '20240001000122_tenants_business_type.sql',
      '20240001000130_hotel_room_capacity.sql',
    ],
  })
  client = db.client
}, 60_000)

afterAll(async () => {
  await db.teardown()
})

describe('enforce_room_capacity() — hotel vs hostel', () => {
  it('rejects a second overlapping confirmed booking on a hotel room even with capacity 2', async () => {
    const tenantId = await createTenant('hotel')
    const roomId = await createRoomWithCapacity(tenantId, 2)
    const occupantA = await createOccupant(tenantId)
    const occupantB = await createOccupant(tenantId)

    await insertBooking(tenantId, roomId, occupantA, '2026-01-01', '2026-01-05')

    await expect(
      insertBooking(tenantId, roomId, occupantB, '2026-01-02', '2026-01-04'),
    ).rejects.toThrow(/at capacity/i)
  })

  it('allows a second overlapping confirmed booking on a hostel room with capacity 2', async () => {
    const tenantId = await createTenant('hostel')
    const roomId = await createRoomWithCapacity(tenantId, 2)
    const occupantA = await createOccupant(tenantId)
    const occupantB = await createOccupant(tenantId)

    await insertBooking(tenantId, roomId, occupantA, '2026-01-01', '2026-01-05')

    // Should succeed — this is the existing dorm-style multi-occupancy
    // behavior from migration 101, unaffected by the hotel-only fix.
    const secondId = await insertBooking(tenantId, roomId, occupantB, '2026-01-02', '2026-01-04')
    const row = await client.query(`select id from bookings where id = $1`, [secondId])
    expect(row.rows.length).toBe(1)
  })

  it('still rejects a third overlapping booking on a hostel room once capacity 2 is reached', async () => {
    const tenantId = await createTenant('hostel')
    const roomId = await createRoomWithCapacity(tenantId, 2)
    const occupantA = await createOccupant(tenantId)
    const occupantB = await createOccupant(tenantId)
    const occupantC = await createOccupant(tenantId)

    await insertBooking(tenantId, roomId, occupantA, '2026-02-01', '2026-02-05')
    await insertBooking(tenantId, roomId, occupantB, '2026-02-02', '2026-02-04')

    await expect(
      insertBooking(tenantId, roomId, occupantC, '2026-02-02', '2026-02-03'),
    ).rejects.toThrow(/at capacity/i)
  })

  it('allows a non-overlapping booking on the same hotel room after the first stay ends', async () => {
    const tenantId = await createTenant('hotel')
    const roomId = await createRoomWithCapacity(tenantId, 2)
    const occupantA = await createOccupant(tenantId)
    const occupantB = await createOccupant(tenantId)

    await insertBooking(tenantId, roomId, occupantA, '2026-03-01', '2026-03-05')

    // Check-in on the exact checkout date — non-overlapping (bookings use a
    // half-open [check_in, check_out) range).
    const secondId = await insertBooking(tenantId, roomId, occupantB, '2026-03-05', '2026-03-08')
    const row = await client.query(`select id from bookings where id = $1`, [secondId])
    expect(row.rows.length).toBe(1)
  })
})
