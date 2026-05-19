/**
 * Shared helper to initialize a Paystack hosted-payment transaction for a
 * newly-created booking. Used by public and widget booking endpoints so they
 * can return an `authorization_url` to send the guest to Paystack.
 *
 * Returns `null` when the tenant has not connected a Paystack subaccount yet.
 * Callers should treat that as "no online payment available, fall back to
 * pay-on-arrival" rather than an error.
 */
import { initializeTransaction, type PaymentChannel } from '@/lib/paystack'

export type BookingPaymentSource = 'public_booking' | 'widget_booking'

export interface InitBookingPaymentParams {
  tenantId: string
  tenantSubaccount: string | null
  bookingId: string
  bookingRef: string
  amountPesewas: number
  email: string | null
  callbackUrl: string
  source: BookingPaymentSource
  channels?: PaymentChannel[]
}

export interface InitBookingPaymentResult {
  authorizationUrl: string
  reference: string
  amount: number
}

const DEFAULT_CHANNELS: PaymentChannel[] = ['card', 'mobile_money', 'bank', 'bank_transfer']

export async function initBookingPayment(
  params: InitBookingPaymentParams,
): Promise<InitBookingPaymentResult | null> {
  if (!process.env.PAYSTACK_SECRET_KEY) return null
  if (!params.tenantSubaccount) return null
  if (params.amountPesewas <= 0) return null

  const email = params.email ?? `${params.bookingRef.toLowerCase()}@booking.local`
  const reference = `${params.bookingRef}-${Date.now()}`

  const result = await initializeTransaction({
    email,
    amountPesewas: params.amountPesewas,
    reference,
    callbackUrl:   params.callbackUrl,
    channels:      params.channels ?? DEFAULT_CHANNELS,
    metadata: {
      booking_id:  params.bookingId,
      booking_ref: params.bookingRef,
      tenant_id:   params.tenantId,
      source:      params.source,
    },
    subaccount: params.tenantSubaccount,
    bearer:     'subaccount',
  })

  return {
    authorizationUrl: result.authorizationUrl,
    reference:        result.reference,
    amount:           params.amountPesewas,
  }
}
