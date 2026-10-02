/**
 * Unit tests for finalizeOnlineBookingPayment() (lib/payments/record-online-payment.ts)
 * — the idempotent insert-if-new-reference + auto-confirm logic extracted
 * from the two near-duplicate Paystack callback routes. A minimal fake
 * Supabase client stands in for the real one, matching the style of
 * tests/unit/resolve-occupant.test.ts.
 */
import { describe, expect, it } from 'vitest'
import { finalizeOnlineBookingPayment } from '@/lib/payments/record-online-payment'

function fakeSupabase(opts: {
  booking: { id: string; tenant_id: string; paid_amount: number; final_amount: number; status: string }
  existingReferences?: Set<string>
}) {
  const existingReferences = opts.existingReferences ?? new Set<string>()
  const inserted: any[] = []
  const bookingUpdates: any[] = []
  let booking = { ...opts.booking }

  const client: any = {
    from(table: string) {
      if (table === 'bookings') {
        return {
          select() { return this },
          eq() { return this },
          maybeSingle: async () => ({ data: booking }),
          update(patch: any) {
            bookingUpdates.push(patch)
            booking = { ...booking, ...patch }
            return { eq() { return this }, then: (res: any) => res({ data: null, error: null }) }
          },
        }
      }
      if (table === 'booking_payments') {
        let ref = ''
        return {
          select() { return this },
          eq(_col: string, val: string) {
            ref = val
            return this
          },
          maybeSingle: async () => ({ data: existingReferences.has(ref) ? { id: 'existing-payment' } : null }),
          insert(row: any) {
            inserted.push(row)
            existingReferences.add(row.paystack_reference)
            return { then: (res: any) => res({ data: null, error: null }) }
          },
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }

  return { client, inserted, bookingUpdates, getBooking: () => booking }
}

describe('finalizeOnlineBookingPayment', () => {
  it('records a new payment and confirms a pending_payment booking once fully paid', async () => {
    const { client, inserted, getBooking } = fakeSupabase({
      booking: { id: 'b1', tenant_id: 't1', paid_amount: 0, final_amount: 5000, status: 'pending_payment' },
    })

    const result = await finalizeOnlineBookingPayment(client, {
      tenantId: 't1', bookingId: 'b1', amount: 5000, reference: 'ref-1',
    })

    expect(result.recorded).toBe(true)
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({ amount: 5000, paystack_reference: 'ref-1', status: 'success' })
    expect(getBooking().status).toBe('confirmed')
  })

  it('does not auto-confirm when the payment only partially covers the balance', async () => {
    const { client, getBooking } = fakeSupabase({
      booking: { id: 'b1', tenant_id: 't1', paid_amount: 0, final_amount: 5000, status: 'pending_payment' },
    })

    await finalizeOnlineBookingPayment(client, { tenantId: 't1', bookingId: 'b1', amount: 2000, reference: 'ref-1' })

    expect(getBooking().status).toBe('pending_payment')
  })

  it('is idempotent — a second call with the same reference does not record or notify twice', async () => {
    const { client, inserted } = fakeSupabase({
      booking: { id: 'b1', tenant_id: 't1', paid_amount: 0, final_amount: 5000, status: 'pending_payment' },
      existingReferences: new Set(['ref-1']),
    })

    const result = await finalizeOnlineBookingPayment(client, {
      tenantId: 't1', bookingId: 'b1', amount: 5000, reference: 'ref-1',
    })

    expect(result.recorded).toBe(false)
    expect(inserted).toHaveLength(0)
  })

  it('returns recorded: false for an unknown booking', async () => {
    const client: any = {
      from() {
        return { select() { return this }, eq() { return this }, maybeSingle: async () => ({ data: null }) }
      },
    }

    const result = await finalizeOnlineBookingPayment(client, {
      tenantId: 't1', bookingId: 'missing', amount: 1000, reference: 'ref-x',
    })

    expect(result.recorded).toBe(false)
  })
})
