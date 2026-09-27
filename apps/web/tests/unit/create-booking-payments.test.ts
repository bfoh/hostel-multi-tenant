/**
 * Unit tests for the payment-collection addition to createBooking()
 * (lib/bookings/create-booking.ts) — a Payment Type of Full/Part at
 * booking-creation time (see PaymentSplitInput) should insert
 * booking_payments rows and, when the sum covers the final amount,
 * auto-confirm the booking exactly like the existing
 * /api/bookings/[id]/payments route already does for a payment recorded
 * after the fact. Omitting `payments` entirely must behave exactly as
 * before (regression guard for the pre-existing hostel/hotel booking flow).
 * A minimal fake Supabase client stands in for the real one, mirroring the
 * pattern in tests/unit/resolve-occupant.test.ts.
 */
import { describe, expect, it } from 'vitest'
import { createBooking } from '@/lib/bookings/create-booking'

function fakeSupabase(opts: { baseRate: number; activeCount?: number }) {
  const bookingInserts: any[] = []
  const bookingUpdates: any[] = []
  const paymentInserts: any[][] = []

  const client: any = {
    from(table: string) {
      if (table === 'rooms') {
        return {
          select() { return this },
          eq() { return this },
          single: async () => ({
            data: {
              id: 'room-1', room_number: '101', status: 'available',
              category: { base_rate: opts.baseRate, rate_unit: 'night', capacity: 2 },
            },
            error: null,
          }),
          update() {
            return { eq: async () => ({ data: null, error: null }) }
          },
        }
      }
      if (table === 'tenants') {
        return {
          select() { return this },
          eq() { return this },
          single: async () => ({ data: { business_type: 'hotel' } }),
        }
      }
      if (table === 'bookings') {
        return {
          select(_cols: string, selectOpts?: { count?: string }) {
            if (selectOpts?.count) {
              const chain: any = {
                eq()  { return chain },
                lte() { return chain },
                gte() { return chain },
                in: async () => ({ count: opts.activeCount ?? 0 }),
              }
              return chain
            }
            return this
          },
          insert(row: any) {
            bookingInserts.push(row)
            return {
              select() {
                return { single: async () => ({ data: { id: 'booking-1', booking_ref: 'ABR-2026-000001' }, error: null }) }
              },
            }
          },
          update(patch: any) {
            bookingUpdates.push(patch)
            return { eq: async () => ({ data: null, error: null }) }
          },
        }
      }
      if (table === 'booking_payments') {
        return {
          insert: async (rows: any[]) => { paymentInserts.push(rows); return { error: null } },
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }

  return { client, bookingInserts, bookingUpdates, paymentInserts }
}

const baseParams = {
  occupant_id:    'occupant-1',
  room_id:        'room-1',
  check_in_date:  '2026-10-01',
  check_out_date: '2026-10-02',
  source:         'walk_in' as const,
}

describe('createBooking — payment collection', () => {
  it('auto-confirms the booking when payments fully cover the final amount', async () => {
    const { client, bookingUpdates, paymentInserts } = fakeSupabase({ baseRate: 10000 })

    const result = await createBooking(client, 'tenant-1', {
      ...baseParams,
      payments:   [{ method: 'cash', amount: 10000 }],
      receivedBy: 'staff-1',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.status).toBe('confirmed')
    expect(paymentInserts).toHaveLength(1)
    expect(paymentInserts[0]).toMatchObject([
      { booking_id: 'booking-1', amount: 10000, method: 'cash', status: 'success', received_by: 'staff-1' },
    ])
    expect(bookingUpdates).toContainEqual({ status: 'confirmed' })
  })

  it('splits across methods and still confirms once the sum covers the total', async () => {
    const { client, paymentInserts, bookingUpdates } = fakeSupabase({ baseRate: 10000 })

    const result = await createBooking(client, 'tenant-1', {
      ...baseParams,
      payments: [
        { method: 'cash', amount: 6000 },
        { method: 'momo_mtn', amount: 4000 },
      ],
      receivedBy: 'staff-1',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.status).toBe('confirmed')
    expect(paymentInserts[0]).toHaveLength(2)
    expect(bookingUpdates).toContainEqual({ status: 'confirmed' })
  })

  it('leaves the booking pending_payment when the payment only partially covers the total', async () => {
    const { client, paymentInserts, bookingUpdates } = fakeSupabase({ baseRate: 10000 })

    const result = await createBooking(client, 'tenant-1', {
      ...baseParams,
      payments:   [{ method: 'cash', amount: 4000 }],
      receivedBy: 'staff-1',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.status).toBe('pending_payment')
    expect(paymentInserts).toHaveLength(1)
    expect(bookingUpdates).toHaveLength(0) // no auto-confirm update fired
  })

  it('behaves exactly as before when no payments are provided (regression guard)', async () => {
    const { client, paymentInserts, bookingUpdates } = fakeSupabase({ baseRate: 10000 })

    const result = await createBooking(client, 'tenant-1', { ...baseParams })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.status).toBe('pending_payment')
    expect(paymentInserts).toHaveLength(0)
    expect(bookingUpdates).toHaveLength(0)
  })
})
