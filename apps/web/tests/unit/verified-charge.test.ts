/**
 * Paystack redirect callbacks must only record a verified charge against the
 * booking it was initialised for, and only for the amount Paystack settled.
 * Covers the pure check (lib/payments/verified-charge.ts) and the public
 * callback route end to end with a stubbed Paystack + Supabase, including
 * the replay of a cheap reference onto an expensive booking.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { checkVerifiedBookingCharge } from '@/lib/payments/verified-charge'

const BOOKING = '11111111-1111-4111-8111-111111111111'
const OTHER_BOOKING = '22222222-2222-4222-8222-222222222222'
const TENANT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function verified(overrides: Record<string, unknown> = {}, metadata: unknown = { booking_id: BOOKING, tenant_id: TENANT }) {
  return { status: true, data: { status: 'success', currency: 'GHS', amount: 25000, metadata, ...overrides } }
}

describe('checkVerifiedBookingCharge', () => {
  const expected = { bookingId: BOOKING, tenantId: TENANT }

  it("returns Paystack's settled amount for a matching charge", () => {
    expect(checkVerifiedBookingCharge(verified(), expected)).toEqual({ ok: true, amount: 25000 })
  })

  it('accepts metadata echoed back as a JSON string', () => {
    const res = verified({}, JSON.stringify({ booking_id: BOOKING, tenant_id: TENANT }))
    expect(checkVerifiedBookingCharge(res, expected)).toEqual({ ok: true, amount: 25000 })
  })

  it('rejects a charge initialised for a different booking', () => {
    const res = verified({}, { booking_id: OTHER_BOOKING, tenant_id: TENANT })
    expect(checkVerifiedBookingCharge(res, expected)).toEqual({ ok: false, reason: 'booking_mismatch' })
  })

  it('rejects a charge initialised for a different tenant', () => {
    const res = verified({}, { booking_id: BOOKING, tenant_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' })
    expect(checkVerifiedBookingCharge(res, expected)).toEqual({ ok: false, reason: 'tenant_mismatch' })
  })

  it('credits the requested amount, not a Paystack fee passed on to the customer', () => {
    expect(checkVerifiedBookingCharge(verified({ amount: 25375, requested_amount: 25000 }), expected)).toEqual({ ok: true, amount: 25000 })
    // A requested_amount above what was charged is ignored.
    expect(checkVerifiedBookingCharge(verified({ amount: 25000, requested_amount: 90000 }), expected)).toEqual({ ok: true, amount: 25000 })
  })

  it('rejects charges with no booking metadata (walk-in, food, subscription…)', () => {
    expect(checkVerifiedBookingCharge(verified({}, { source: 'walkin_sale', tenant_id: TENANT }), expected).ok).toBe(false)
    expect(checkVerifiedBookingCharge(verified({}, null), expected).ok).toBe(false)
    expect(checkVerifiedBookingCharge(verified({}, 'not json'), expected).ok).toBe(false)
  })

  it('rejects unsuccessful, non-GHS or malformed-amount charges', () => {
    expect(checkVerifiedBookingCharge(verified({ status: 'abandoned' }), expected)).toEqual({ ok: false, reason: 'not_successful' })
    expect(checkVerifiedBookingCharge({ status: false, data: null }, expected)).toEqual({ ok: false, reason: 'not_successful' })
    expect(checkVerifiedBookingCharge(verified({ currency: 'USD' }), expected)).toEqual({ ok: false, reason: 'currency_mismatch' })
    expect(checkVerifiedBookingCharge(verified({ amount: 0 }), expected)).toEqual({ ok: false, reason: 'invalid_amount' })
    expect(checkVerifiedBookingCharge(verified({ amount: '25000' }), expected)).toEqual({ ok: false, reason: 'invalid_amount' })
  })
})

// ── Route: GET /api/public/[slug]/pay/callback ─────────────────────────────

const finalize = vi.fn()
vi.mock('@/lib/payments/record-online-payment', () => ({
  finalizeOnlineBookingPayment: (...args: unknown[]) => finalize(...args),
  notifyOnlinePayment: () => Promise.resolve(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from(table: string) {
      const filters: Record<string, unknown> = {}
      const q = {
        select: () => q,
        eq: (col: string, val: unknown) => { filters[col] = val; return q },
        maybeSingle: async () => {
          if (table === 'tenants') return { data: filters.slug === 'acacia' ? { id: TENANT } : null }
          if (table === 'bookings') {
            const ok = filters.tenant_id === TENANT && (filters.id === BOOKING || filters.id === OTHER_BOOKING)
            return { data: ok ? { id: filters.id, tenant_id: TENANT, paid_amount: 0, final_amount: 450000, status: 'pending_payment' } : null }
          }
          return { data: null }
        },
      }
      return q
    },
  }),
}))

describe('public pay callback', () => {
  let paystackResponse: unknown

  beforeEach(() => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_dummy'
    finalize.mockReset().mockResolvedValue({ recorded: true })
    vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => paystackResponse })))
  })
  afterEach(() => vi.unstubAllGlobals())

  async function callback(query: string) {
    const { GET } = await import('@/app/api/public/[slug]/pay/callback/route')
    const { NextRequest } = await import('next/server')
    const res = await GET(new NextRequest(`https://acacia.example.com/api/public/acacia/pay/callback?${query}`), {
      params: Promise.resolve({ slug: 'acacia' }),
    })
    return res.headers.get('location') ?? ''
  }

  it("records Paystack's amount, ignoring an inflated ?amount=", async () => {
    paystackResponse = verified()
    const location = await callback(`reference=REF-1&booking_id=${BOOKING}&amount=999999999`)
    expect(location).toContain('pay=success')
    expect(finalize).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ bookingId: BOOKING, amount: 25000, reference: 'REF-1' }))
  })

  it('refuses to apply a cheap reference to a different booking', async () => {
    paystackResponse = verified() // charge was initialised for BOOKING
    const location = await callback(`reference=REF-1&booking_id=${OTHER_BOOKING}&amount=450000`)
    expect(location).toContain('pay=error')
    expect(finalize).not.toHaveBeenCalled()
  })

  it('still works for older links without ?amount=', async () => {
    paystackResponse = verified()
    const location = await callback(`reference=REF-2&booking_id=${BOOKING}`)
    expect(location).toContain('pay=success')
    expect(finalize).toHaveBeenCalledTimes(1)
  })

  it('does not record a failed transaction', async () => {
    paystackResponse = verified({ status: 'failed' })
    expect(await callback(`reference=REF-3&booking_id=${BOOKING}`)).toContain('pay=failed')
    expect(finalize).not.toHaveBeenCalled()
  })
})
