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
  booking: {
    id: string
    tenant_id: string
    paid_amount: number
    final_amount: number
    status: string
  }
  existingReferences?: Set<string>
}) {
  const existingReferences = opts.existingReferences ?? new Set<string>()
  const inserted: any[] = []
  const exceptions: any[] = []
  const auditEntries: any[] = []
  const bookingUpdates: any[] = []
  let booking = { ...opts.booking }

  const client: any = {
    async rpc(name: string, args: any) {
      if (name !== 'finalize_online_booking_payment') throw new Error(`unexpected rpc ${name}`)
      if (existingReferences.has(args.p_reference)) {
        return { data: { recorded: false }, error: null }
      }

      inserted.push({
        tenant_id: args.p_tenant_id,
        booking_id: args.p_booking_id,
        amount: args.p_amount,
        method: args.p_method,
        paystack_reference: args.p_reference,
        status: 'success',
        notes: args.p_notes,
      })
      existingReferences.add(args.p_reference)
      booking = { ...booking, paid_amount: booking.paid_amount + args.p_amount }

      if (booking.status === 'cancelled') {
        exceptions.push({
          tenant_id: args.p_tenant_id,
          booking_id: args.p_booking_id,
          paystack_reference: args.p_reference,
          exception_type: 'late_payment_after_cancellation',
          status: 'open',
          amount: args.p_amount,
        })
        auditEntries.push({ action: 'payment.requires_resolution' })
        return { data: { recorded: true, requires_resolution: true }, error: null }
      }

      if (booking.status === 'pending_payment' && booking.paid_amount >= booking.final_amount) {
        bookingUpdates.push({ status: 'confirmed' })
        booking = { ...booking, status: 'confirmed' }
      }
      return { data: { recorded: true, requires_resolution: false }, error: null }
    },
    from(table: string) {
      if (table === 'bookings') {
        return {
          select() {
            return this
          },
          eq() {
            return this
          },
          maybeSingle: async () => ({ data: booking }),
          update(patch: any) {
            bookingUpdates.push(patch)
            booking = { ...booking, ...patch }
            return {
              eq() {
                return this
              },
              then: (res: any) => res({ data: null, error: null }),
            }
          },
        }
      }
      if (table === 'booking_payments') {
        let ref = ''
        return {
          select() {
            return this
          },
          eq(_col: string, val: string) {
            ref = val
            return this
          },
          maybeSingle: async () => ({
            data: existingReferences.has(ref) ? { id: 'existing-payment' } : null,
          }),
          insert(row: any) {
            inserted.push(row)
            existingReferences.add(row.paystack_reference)
            return { then: (res: any) => res({ data: null, error: null }) }
          },
        }
      }
      if (table === 'booking_payment_exceptions') {
        return {
          upsert(row: any) {
            exceptions.push(row)
            return Promise.resolve({ data: row, error: null })
          },
        }
      }
      if (table === 'audit_log') {
        return {
          insert(row: any) {
            auditEntries.push(row)
            return Promise.resolve({ data: row, error: null })
          },
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }

  return { client, inserted, exceptions, auditEntries, bookingUpdates, getBooking: () => booking }
}

describe('finalizeOnlineBookingPayment', () => {
  it('records a new payment and confirms a pending_payment booking once fully paid', async () => {
    const { client, inserted, getBooking } = fakeSupabase({
      booking: {
        id: 'b1',
        tenant_id: 't1',
        paid_amount: 0,
        final_amount: 5000,
        status: 'pending_payment',
      },
    })

    const result = await finalizeOnlineBookingPayment(client, {
      tenantId: 't1',
      bookingId: 'b1',
      amount: 5000,
      reference: 'ref-1',
    })

    expect(result.recorded).toBe(true)
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({
      amount: 5000,
      paystack_reference: 'ref-1',
      status: 'success',
    })
    expect(getBooking().status).toBe('confirmed')
  })

  it('does not auto-confirm when the payment only partially covers the balance', async () => {
    const { client, getBooking } = fakeSupabase({
      booking: {
        id: 'b1',
        tenant_id: 't1',
        paid_amount: 0,
        final_amount: 5000,
        status: 'pending_payment',
      },
    })

    await finalizeOnlineBookingPayment(client, {
      tenantId: 't1',
      bookingId: 'b1',
      amount: 2000,
      reference: 'ref-1',
    })

    expect(getBooking().status).toBe('pending_payment')
  })

  it('is idempotent — a second call with the same reference does not record or notify twice', async () => {
    const { client, inserted } = fakeSupabase({
      booking: {
        id: 'b1',
        tenant_id: 't1',
        paid_amount: 0,
        final_amount: 5000,
        status: 'pending_payment',
      },
      existingReferences: new Set(['ref-1']),
    })

    const result = await finalizeOnlineBookingPayment(client, {
      tenantId: 't1',
      bookingId: 'b1',
      amount: 5000,
      reference: 'ref-1',
    })

    expect(result.recorded).toBe(false)
    expect(inserted).toHaveLength(0)
  })

  it('returns recorded: false for an unknown booking', async () => {
    const client: any = {
      rpc: async () => ({ data: { recorded: false, reason: 'booking_not_found' }, error: null }),
    }

    const result = await finalizeOnlineBookingPayment(client, {
      tenantId: 't1',
      bookingId: 'missing',
      amount: 1000,
      reference: 'ref-x',
    })

    expect(result.recorded).toBe(false)
  })

  it('queues a resolution case instead of restoring a cancelled booking', async () => {
    const { client, exceptions, auditEntries, getBooking } = fakeSupabase({
      booking: {
        id: 'b1',
        tenant_id: 't1',
        paid_amount: 0,
        final_amount: 5000,
        status: 'cancelled',
      },
    })

    const result = await finalizeOnlineBookingPayment(client, {
      tenantId: 't1',
      bookingId: 'b1',
      amount: 5000,
      reference: 'late-ref',
    })

    expect(result).toEqual({ recorded: true, requiresResolution: true })
    expect(getBooking().status).toBe('cancelled')
    expect(exceptions[0]).toMatchObject({
      booking_id: 'b1',
      paystack_reference: 'late-ref',
      exception_type: 'late_payment_after_cancellation',
      status: 'open',
    })
    expect(auditEntries[0]).toMatchObject({ action: 'payment.requires_resolution' })
  })
})
