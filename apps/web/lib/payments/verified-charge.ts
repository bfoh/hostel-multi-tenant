/**
 * Validates a Paystack `GET /transaction/verify/:reference` response before a
 * redirect callback records it against a booking, and returns the amount
 * Paystack actually charged.
 *
 * The callbacks used to record whatever `?amount=` the URL carried once the
 * reference verified as *some* successful transaction — so any cheap
 * successful charge on the platform account could be replayed against a
 * different, more expensive booking with an inflated amount. A charge now only
 * counts for a booking when the metadata our server attached at
 * initialisation (lib/booking-payment.ts, app/api/public/[slug]/pay,
 * app/api/occupant/pay) names that same booking and tenant, and only for the
 * amount Paystack settled.
 */
export type VerifiedBookingCharge =
  | { ok: true; amount: number }
  | {
      ok: false
      reason: 'not_successful' | 'currency_mismatch' | 'invalid_amount' | 'booking_mismatch' | 'tenant_mismatch'
    }

export function checkVerifiedBookingCharge(
  verifyResponse: unknown,
  expected: { bookingId: string; tenantId: string },
): VerifiedBookingCharge {
  const res = verifyResponse as { status?: unknown; data?: Record<string, unknown> } | null
  const data = res?.data
  if (!res?.status || !data || data.status !== 'success') return { ok: false, reason: 'not_successful' }

  if (data.currency !== 'GHS') return { ok: false, reason: 'currency_mismatch' }

  const amount = creditedAmount(data)
  if (amount === null) return { ok: false, reason: 'invalid_amount' }

  // Paystack echoes metadata back as sent (an object), but older integrations
  // stored it as a JSON string — accept both.
  let metadata = data.metadata as Record<string, unknown> | string | null | undefined
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata) as Record<string, unknown>
    } catch {
      metadata = null
    }
  }
  const md = metadata && typeof metadata === 'object' ? metadata : {}

  if (md.booking_id !== expected.bookingId) return { ok: false, reason: 'booking_mismatch' }
  if (md.tenant_id !== expected.tenantId) return { ok: false, reason: 'tenant_mismatch' }

  return { ok: true, amount }
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0
}

/**
 * What a successful charge is worth to us. When a merchant passes Paystack
 * fees on to the customer, `amount` includes the fee and `requested_amount`
 * is what we asked for — credit the latter so a booking is never credited
 * with the processing fee.
 */
function creditedAmount(data: Record<string, unknown>): number | null {
  if (!isPositiveInt(data.amount)) return null
  if (isPositiveInt(data.requested_amount) && data.requested_amount <= data.amount) return data.requested_amount
  return data.amount
}

export type ChargeCheck =
  | { ok: true; amount: number }
  | { ok: false; reason: 'currency_mismatch' | 'invalid_amount' | 'underpaid'; charged: number | null }

/**
 * For the Paystack webhook: does a successful charge cover the amount the
 * record it settles expects? `expected` must come from our own data (the
 * pending row, the order total, or the metadata our server attached at
 * initialisation) — never from the payload being checked.
 */
export function checkChargeCoversExpected(eventData: unknown, expected: number): ChargeCheck {
  const data = (eventData ?? {}) as Record<string, unknown>
  const charged = creditedAmount(data)
  if (data.currency !== 'GHS') return { ok: false, reason: 'currency_mismatch', charged }
  if (charged === null || !isPositiveInt(expected)) return { ok: false, reason: 'invalid_amount', charged }
  if (charged < expected) return { ok: false, reason: 'underpaid', charged }
  return { ok: true, amount: charged }
}
