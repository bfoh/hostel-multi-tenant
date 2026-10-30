/**
 * Migration 147: row triggers queue webhook events in the same transaction as
 * the change, so every code path that books, confirms, checks in, takes
 * payment, logs maintenance or registers an occupant reaches subscribed
 * endpoints — not only the routes that remember to call fireWebhook().
 */
import { randomUUID } from 'node:crypto'

import type { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { startTestDb, type TestDb } from './harness'

let db: TestDb
let client: Client

const tenantId = randomUUID()
const otherTenantId = randomUUID()
const roomId = randomUUID()
const occupantId = randomUUID()
const allEndpoint = randomUUID()
const paymentsEndpoint = randomUUID()
const pausedEndpoint = randomUUID()

async function eventsFor(endpointId: string): Promise<Array<{ event_type: string; data: any }>> {
  const { rows } = await client.query(
    `select event_type, payload->'data' as data from webhook_events
      where endpoint_id = $1 order by created_at`,
    [endpointId]
  )
  return rows
}

// Each booking gets its own week so confirmed ones never trip no_double_booking.
let bookingWeek = 0
async function insertBooking(status = 'pending_payment'): Promise<string> {
  const id = randomUUID()
  await client.query(
    `insert into bookings (id, tenant_id, booking_ref, occupant_id, room_id, status, source,
                           check_in_date, check_out_date, rate_per_unit, rate_unit, total_amount)
     values ($1, $2, $3, $4, $5, $6, 'website',
             date '2026-11-02' + $7::int, date '2026-11-05' + $7::int, 120000, 'night', 360000)`,
    [id, tenantId, `WH-${id.slice(0, 8)}`, occupantId, roomId, status, 7 * bookingWeek++]
  )
  return id
}

beforeAll(async () => {
  db = await startTestDb({
    extraMigrationFiles: [
      '20240001000034_webhooks.sql',
      '20240001000147_webhook_event_outbox.sql',
    ],
  })
  client = db.client

  for (const [id, slug] of [[tenantId, 'wh-main'], [otherTenantId, 'wh-other']]) {
    await client.query(`insert into tenants (id, name, slug) values ($1, 'Webhook Test', $2)`, [id, slug])
  }
  const categoryId = randomUUID()
  await client.query(
    `insert into room_categories (id, tenant_id, name, type, base_rate) values ($1, $2, 'Double', 'double', 120000)`,
    [categoryId, tenantId]
  )
  await client.query(
    `insert into rooms (id, tenant_id, category_id, room_number) values ($1, $2, $3, 'W-1')`,
    [roomId, tenantId, categoryId]
  )
  await client.query(
    `insert into webhook_endpoints (id, tenant_id, url, events, is_active) values
       ($1, $4, 'https://all.example/hook', '{*}', true),
       ($2, $4, 'https://pay.example/hook', '{payment.received}', true),
       ($3, $4, 'https://paused.example/hook', '{*}', false)`,
    [allEndpoint, paymentsEndpoint, pausedEndpoint, tenantId]
  )
  await client.query(
    `insert into occupants (id, tenant_id, first_name, last_name, phone, email, national_id_number)
     values ($1, $2, 'Ama', 'Mensah', '0244000000', 'ama@example.invalid', 'GHA-000000000-0')`,
    [occupantId, tenantId]
  )
}, 60_000)

afterAll(async () => {
  if (db) await db.teardown()
})

beforeEach(async () => {
  await client.query(`delete from webhook_events`)
})

describe('webhook outbox triggers', () => {
  it('queues the booking lifecycle in order, for subscribed active endpoints only', async () => {
    const bookingId = await insertBooking()
    for (const status of ['confirmed', 'checked_in', 'checked_out']) {
      await client.query(`update bookings set status = $1 where id = $2`, [status, bookingId])
    }
    // Same status again, and an unrelated column change: no new events.
    await client.query(`update bookings set status = 'checked_out', notes = 'late' where id = $1`, [bookingId])

    const events = await eventsFor(allEndpoint)
    expect(events.map((e) => e.event_type)).toEqual([
      'booking.created',
      'booking.confirmed',
      'booking.checked_in',
      'booking.checked_out',
    ])
    expect(events[0].data).toMatchObject({
      booking_id: bookingId,
      status: 'pending_payment',
      check_out_date: '2026-11-05',
      total_amount: 360000,
      final_amount: 360000,
    })
    expect(await eventsFor(paymentsEndpoint)).toEqual([])
    expect(await eventsFor(pausedEndpoint)).toEqual([])
  })

  it('sends the status event too when a booking is created already confirmed', async () => {
    await insertBooking('confirmed')
    expect((await eventsFor(allEndpoint)).map((e) => e.event_type)).toEqual(['booking.created', 'booking.confirmed'])
  })

  it('leaves booking.cancelled to the cancellation service', async () => {
    const bookingId = await insertBooking()
    await client.query(`delete from webhook_events`)
    await client.query(`update bookings set status = 'cancelled' where id = $1`, [bookingId])
    expect(await eventsFor(allEndpoint)).toEqual([])
  })

  it('queues payment.received once, when a payment succeeds', async () => {
    const bookingId = await insertBooking()
    const paymentId = randomUUID()
    await client.query(
      `insert into booking_payments (id, tenant_id, booking_id, amount, method, status)
       values ($1, $2, $3, 360000, 'momo_mtn', 'pending')`,
      [paymentId, tenantId, bookingId]
    )
    expect(await eventsFor(paymentsEndpoint)).toEqual([])

    await client.query(`update booking_payments set status = 'success', paid_at = now() where id = $1`, [paymentId])
    await client.query(`update booking_payments set status = 'success' where id = $1`, [paymentId])
    await client.query(
      `insert into booking_payments (tenant_id, booking_id, amount, method, status, paid_at)
       values ($1, $2, 5000, 'cash', 'success', now())`,
      [tenantId, bookingId]
    )

    const events = await eventsFor(paymentsEndpoint)
    expect(events.map((e) => [e.event_type, e.data.amount])).toEqual([
      ['payment.received', 360000],
      ['payment.received', 5000],
    ])
    expect(events[0].data).toMatchObject({ payment_id: paymentId, booking_id: bookingId, method: 'momo_mtn' })
  })

  it('queues maintenance.created and maintenance.resolved', async () => {
    const id = randomUUID()
    await client.query(
      `insert into maintenance_requests (id, tenant_id, ref_number, title, category, room_id)
       values ($1, $2, 'MR-001', 'Leaking tap', 'plumbing', $3)`,
      [id, tenantId, roomId]
    )
    await client.query(`update maintenance_requests set status = 'in_progress' where id = $1`, [id])
    await client.query(`update maintenance_requests set status = 'completed', resolved_at = now() where id = $1`, [id])

    const events = await eventsFor(allEndpoint)
    expect(events.map((e) => e.event_type)).toEqual(['maintenance.created', 'maintenance.resolved'])
    expect(events[1].data).toMatchObject({ maintenance_id: id, ref_number: 'MR-001', status: 'completed' })
  })

  it('queues occupant.created without identity documents', async () => {
    const id = randomUUID()
    await client.query(
      `insert into occupants (id, tenant_id, first_name, last_name, phone, national_id_number, date_of_birth)
       values ($1, $2, 'Kofi', 'Boateng', '0200000000', 'GHA-111111111-1', '2004-01-01')`,
      [id, tenantId]
    )
    const [event] = await eventsFor(allEndpoint)
    expect(event.event_type).toBe('occupant.created')
    expect(event.data).toMatchObject({ occupant_id: id, first_name: 'Kofi', last_name: 'Boateng', phone: '0200000000' })
    expect(event.data).not.toHaveProperty('national_id_number')
    expect(event.data).not.toHaveProperty('date_of_birth')
  })

  it("never queues another tenant's events", async () => {
    await client.query(
      `insert into occupants (tenant_id, first_name, last_name, phone) values ($1, 'Other', 'Tenant', '0270000000')`,
      [otherTenantId]
    )
    const { rows } = await client.query(`select count(*)::int as n from webhook_events`)
    expect(rows[0].n).toBe(0)
  })

  it('does not block the business write if queueing fails', async () => {
    await client.query(`alter table webhook_events add constraint wh_test_block check (event_type <> 'occupant.created')`)
    try {
      await client.query(
        `insert into occupants (tenant_id, first_name, last_name, phone) values ($1, 'Still', 'Saved', '0240000001')`,
        [tenantId]
      )
      const { rows } = await client.query(`select count(*)::int as n from occupants where first_name = 'Still'`)
      expect(rows[0].n).toBe(1)
    } finally {
      await client.query(`alter table webhook_events drop constraint wh_test_block`)
    }
  })
})

describe('claim_webhook_events', () => {
  it('claims due events once, then backs off until the retry window passes', async () => {
    await insertBooking()
    const first = await client.query(`select * from claim_webhook_events(10)`)
    expect(first.rows.map((r) => [r.event_type, r.attempts, r.url, r.is_active])).toEqual([
      ['booking.created', 1, 'https://all.example/hook', true],
    ])

    // Still 'pending' (as after a failed attempt) but attempted just now.
    expect((await client.query(`select * from claim_webhook_events(10)`)).rows).toEqual([])

    await client.query(`update webhook_events set last_attempted_at = now() - interval '2 minutes'`)
    const retry = await client.query(`select attempts from claim_webhook_events(10)`)
    expect(retry.rows).toEqual([{ attempts: 2 }])

    // Second retry waits 4 minutes, not 1.
    await client.query(`update webhook_events set last_attempted_at = now() - interval '2 minutes'`)
    expect((await client.query(`select * from claim_webhook_events(10)`)).rows).toEqual([])
  })

  it('skips delivered and failed events and honours the limit', async () => {
    await insertBooking('confirmed')
    await insertBooking('confirmed')
    await client.query(
      `update webhook_events set status = 'delivered'
        where id = (select id from webhook_events order by created_at limit 1)`
    )
    const claimed = await client.query(`select * from claim_webhook_events(2)`)
    expect(claimed.rows).toHaveLength(2)
    const rest = await client.query(`select * from claim_webhook_events(10)`)
    expect(rest.rows).toHaveLength(1)
  })

  it('is callable by the service role only', async () => {
    const { rows } = await client.query(
      `select has_function_privilege('authenticated', 'claim_webhook_events(integer)', 'execute') as authed,
              has_function_privilege('anon', 'claim_webhook_events(integer)', 'execute') as anon,
              has_function_privilege('service_role', 'claim_webhook_events(integer)', 'execute') as service,
              has_function_privilege('authenticated', 'enqueue_webhook_event(uuid, text, jsonb)', 'execute') as enqueue`
    )
    expect(rows[0]).toEqual({ authed: false, anon: false, service: true, enqueue: false })
  })
})
