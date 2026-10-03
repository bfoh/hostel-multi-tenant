import { randomUUID } from 'node:crypto'

import type { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { startTestDb, type TestDb } from './harness'

let db: TestDb
let client: Client

const tenantId = randomUUID()
const actorId = randomUUID()
const roomId = randomUUID()
const occupantId = randomUUID()

async function createBooking(status: string, suffix: string): Promise<string> {
  const id = randomUUID()
  await client.query(
    `insert into bookings (
       id, tenant_id, booking_ref, occupant_id, room_id, status, source,
       check_in_date, check_out_date, rate_per_unit, total_amount
     ) values ($1, $2, $3, $4, $5, $6, 'website', current_date + $7::int, current_date + $7::int + 1, 100000, 100000)`,
    [id, tenantId, `ABR-CANCEL-${suffix}`, occupantId, roomId, status, Number(suffix)]
  )
  return id
}

beforeAll(async () => {
  db = await startTestDb({
    beforeExtraMigrations: `
      alter type booking_status add value if not exists 'pending_confirmation' before 'confirmed';
      alter table bookings
        add column if not exists hold_expires_at timestamptz,
        add column if not exists self_checkin_submitted_at timestamptz;
    `,
    extraMigrationFiles: [
      '20240001000003_audit_log.sql',
      '20240001000140_booking_cancellation_workflow.sql',
    ],
  })
  client = db.client

  await client.query(`insert into auth.users (id) values ($1)`, [actorId])
  await client.query(`insert into tenants (id, name, slug) values ($1, 'Cancellation Test', $2)`, [
    tenantId,
    `cancel-${tenantId.slice(0, 8)}`,
  ])
  const categoryId = randomUUID()
  await client.query(
    `insert into room_categories (id, tenant_id, name, type, base_rate) values ($1, $2, 'Shared', 'dormitory', 100000)`,
    [categoryId, tenantId]
  )
  await client.query(
    `insert into rooms (id, tenant_id, category_id, room_number) values ($1, $2, $3, 'C-101')`,
    [roomId, tenantId, categoryId]
  )
  await client.query(
    `insert into occupants (id, tenant_id, first_name, last_name, phone) values ($1, $2, 'Test', 'Guest', '0244000000')`,
    [occupantId, tenantId]
  )
}, 60_000)

afterAll(async () => {
  if (db) await db.teardown()
})

describe('canonical booking cancellation', () => {
  it('records complete metadata and an exact audit event', async () => {
    const bookingId = await createBooking('pending_payment', '001')

    const result = await client.query(`select cancel_booking($1, $2, $3, $4, $5, $6) as result`, [
      tenantId,
      bookingId,
      'Guest changed plans',
      'staff',
      actorId,
      'pending_payment',
    ])

    expect(result.rows[0].result).toMatchObject({
      changed: true,
      id: bookingId,
      previous_status: 'pending_payment',
      status: 'cancelled',
      cancellation_reason: 'Guest changed plans',
      cancellation_source: 'staff',
    })

    const booking = await client.query(
      `select status, cancelled_at, cancellation_reason, cancellation_source, cancelled_by
         from bookings where id = $1`,
      [bookingId]
    )
    expect(booking.rows[0]).toMatchObject({
      status: 'cancelled',
      cancellation_reason: 'Guest changed plans',
      cancellation_source: 'staff',
      cancelled_by: actorId,
    })
    expect(booking.rows[0].cancelled_at).toBeTruthy()

    const audit = await client.query(
      `select action, actor_id, old_values, new_values
         from audit_log where entity_id = $1 order by occurred_at desc limit 1`,
      [bookingId]
    )
    expect(audit.rows[0]).toMatchObject({
      action: 'booking.cancelled',
      actor_id: actorId,
      old_values: { status: 'pending_payment' },
    })
    expect(audit.rows[0].new_values).toMatchObject({
      status: 'cancelled',
      reason: 'Guest changed plans',
      source: 'staff',
    })
  })

  it('is idempotent and does not add a second cancellation audit event', async () => {
    const bookingId = await createBooking('confirmed', '002')
    await client.query(
      `select cancel_booking($1, $2, 'Duplicate test', 'staff', $3, 'confirmed')`,
      [tenantId, bookingId, actorId]
    )
    const second = await client.query(
      `select cancel_booking($1, $2, 'Duplicate retry', 'staff', $3, 'confirmed') as result`,
      [tenantId, bookingId, actorId]
    )

    expect(second.rows[0].result.changed).toBe(false)
    const audit = await client.query(
      `select count(*)::int as count from audit_log where entity_id = $1 and action = 'booking.cancelled'`,
      [bookingId]
    )
    expect(audit.rows[0].count).toBe(1)
  })

  it('rejects cancellation after check-in', async () => {
    const bookingId = await createBooking('checked_in', '003')
    await expect(
      client.query(
        `select cancel_booking($1, $2, 'Invalid cancellation', 'staff', $3, 'checked_in')`,
        [tenantId, bookingId, actorId]
      )
    ).rejects.toThrow(/cannot be cancelled from status checked_in/i)
  })

  it('keeps cancelled bookings terminal', async () => {
    const bookingId = await createBooking('confirmed', '004')
    await client.query(`select cancel_booking($1, $2, 'Terminal test', 'staff', $3, 'confirmed')`, [
      tenantId,
      bookingId,
      actorId,
    ])

    await expect(
      client.query(`update bookings set status = 'confirmed' where id = $1`, [bookingId])
    ).rejects.toThrow(/cannot change status/i)
  })
})
