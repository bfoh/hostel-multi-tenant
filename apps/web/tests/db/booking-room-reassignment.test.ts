import { randomUUID } from 'node:crypto'

import type { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { startTestDb, type TestDb } from './harness'

let db: TestDb
let client: Client

const tenantId = randomUUID()
const actorId = randomUUID()
const occupantId = randomUUID()
const secondOccupantId = randomUUID()
const roomA = randomUUID()
const roomB = randomUUID()
const roomC = randomUUID()

async function createBooking(params: {
  roomId: string
  occupantId: string
  status?: string
  suffix: string
  dateOffset?: number
}): Promise<string> {
  const id = randomUUID()
  const dateOffset = params.dateOffset ?? Number(params.suffix) * 50
  await client.query(
    `insert into bookings (
       id, tenant_id, booking_ref, occupant_id, room_id, status, source,
       check_in_date, check_out_date, rate_per_unit, total_amount
     ) values (
       $1, $2, $3, $4, $5, $6, 'website',
       current_date + $7::int, current_date + $7::int + 30, 650000, 650000
     )`,
    [
      id,
      tenantId,
      `ABR-ROOM-${params.suffix}`,
      params.occupantId,
      params.roomId,
      params.status ?? 'confirmed',
      dateOffset,
    ]
  )
  return id
}

beforeAll(async () => {
  db = await startTestDb({
    beforeExtraMigrations: `
      alter type booking_status add value if not exists 'pending_confirmation' before 'confirmed';
      alter table tenants add column if not exists business_type text not null default 'hostel';
    `,
    extraMigrationFiles: [
      '20240001000003_audit_log.sql',
      '20240001000101_capacity_aware_bookings.sql',
      '20240001000130_hotel_room_capacity.sql',
      '20240001000142_canonical_room_reassignment.sql',
    ],
  })
  client = db.client

  await client.query(`insert into auth.users (id) values ($1)`, [actorId])
  await client.query(
    `insert into tenants (id, name, slug, business_type)
     values ($1, 'Room Assignment Test', $2, 'hostel')`,
    [tenantId, `room-assignment-${tenantId.slice(0, 8)}`]
  )

  const categoryId = randomUUID()
  await client.query(
    `insert into room_categories (id, tenant_id, name, type, base_rate, capacity)
     values ($1, $2, 'Single', 'single', 650000, 1)`,
    [categoryId, tenantId]
  )
  await client.query(
    `insert into rooms (id, tenant_id, category_id, room_number)
     values ($1, $4, $5, 'A-01'), ($2, $4, $5, 'B-01'), ($3, $4, $5, 'C-01')`,
    [roomA, roomB, roomC, tenantId, categoryId]
  )
  await client.query(
    `insert into occupants (id, tenant_id, first_name, last_name, phone)
     values
       ($1, $3, 'Initial', 'Guest', '0244000001'),
       ($2, $3, 'Second', 'Guest', '0244000002')`,
    [occupantId, secondOccupantId, tenantId]
  )
}, 60_000)

afterAll(async () => {
  if (db) await db.teardown()
})

describe('canonical room reassignment', () => {
  it('replaces the initial assignment and records a locked staff decision', async () => {
    const bookingId = await createBooking({
      roomId: roomA,
      occupantId,
      status: 'pending_payment',
      suffix: '001',
    })

    const response = await client.query(
      `select reassign_booking_room($1, $2, $3, $4, $5, $6, $7) as result`,
      [tenantId, bookingId, roomB, 'Occupant requested a quieter room', actorId, roomA, 'pending_payment']
    )

    expect(response.rows[0].result).toMatchObject({
      changed: true,
      id: bookingId,
      previous_room_id: roomA,
      room_id: roomB,
      room_assignment_source: 'staff_reassignment',
    })

    const booking = await client.query(
      `select room_id, rate_per_unit, room_assignment_source, room_assignment_locked,
              room_assigned_by, room_assigned_at
         from bookings where id = $1`,
      [bookingId]
    )
    expect(booking.rows[0]).toMatchObject({
      room_id: roomB,
      rate_per_unit: 650000,
      room_assignment_source: 'staff_reassignment',
      room_assignment_locked: true,
      room_assigned_by: actorId,
    })
    expect(booking.rows[0].room_assigned_at).toBeTruthy()

    const audit = await client.query(
      `select action, actor_id, old_values, new_values
         from audit_log
        where entity_id = $1 and action = 'booking.room_reassigned'`,
      [bookingId]
    )
    expect(audit.rows).toHaveLength(1)
    expect(audit.rows[0]).toMatchObject({
      action: 'booking.room_reassigned',
      actor_id: actorId,
      old_values: { room_id: roomA, room_number: 'A-01' },
    })
    expect(audit.rows[0].new_values).toMatchObject({
      room_id: roomB,
      room_number: 'B-01',
      reason: 'Occupant requested a quieter room',
    })
  })

  it('prevents a generic update from overwriting a staff assignment', async () => {
    const bookingId = await createBooking({ roomId: roomA, occupantId, suffix: '002' })
    await client.query(
      `select reassign_booking_room($1, $2, $3, 'Maintenance move', $4, $5, 'confirmed')`,
      [tenantId, bookingId, roomB, actorId, roomA]
    )

    await expect(
      client.query(`update bookings set room_id = $1 where id = $2`, [roomA, bookingId])
    ).rejects.toThrow(/authorised reassignment workflow/i)
  })

  it('allows a later staff decision to supersede an earlier staff assignment', async () => {
    const bookingId = await createBooking({ roomId: roomA, occupantId, suffix: '003' })
    await client.query(
      `select reassign_booking_room($1, $2, $3, 'First move', $4, $5, 'confirmed')`,
      [tenantId, bookingId, roomB, actorId, roomA]
    )

    const second = await client.query(
      `select reassign_booking_room($1, $2, $3, 'Final staff placement', $4, $5, 'confirmed') as result`,
      [tenantId, bookingId, roomA, actorId, roomB]
    )

    expect(second.rows[0].result).toMatchObject({
      changed: true,
      previous_room_id: roomB,
      room_id: roomA,
      reason: 'Final staff placement',
    })
  })

  it('rejects an occupied destination without losing the current assignment', async () => {
    const bookingId = await createBooking({
      roomId: roomA,
      occupantId,
      suffix: '004',
      dateOffset: 200,
    })
    await createBooking({
      roomId: roomC,
      occupantId: secondOccupantId,
      suffix: '005',
      dateOffset: 200,
    })

    await expect(
      client.query(
        `select reassign_booking_room($1, $2, $3, 'Move to occupied room', $4, $5, 'confirmed')`,
        [tenantId, bookingId, roomC, actorId, roomA]
      )
    ).rejects.toThrow(/at capacity/i)

    const booking = await client.query(`select room_id from bookings where id = $1`, [bookingId])
    expect(booking.rows[0].room_id).toBe(roomA)
  })

  it('does not treat cancelled booking records as current room occupants', async () => {
    const activeId = await createBooking({
      roomId: roomB,
      occupantId,
      suffix: '006',
      dateOffset: 300,
    })
    const cancelledId = await createBooking({
      roomId: roomB,
      occupantId: secondOccupantId,
      status: 'cancelled',
      suffix: '007',
      dateOffset: 300,
    })

    const currentAssignments = await client.query(
      `select id
         from bookings
        where room_id = $1
          and id in ($2, $3)
          and status in ('pending_confirmation', 'pending_payment', 'confirmed', 'checked_in')
          and check_out_date > current_date`,
      [roomB, activeId, cancelledId]
    )

    expect(currentAssignments.rows.map((row) => row.id)).toEqual([activeId])
  })
})
