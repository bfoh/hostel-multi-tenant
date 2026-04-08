/**
 * Paystack API client — server-side only.
 * Used for initiating Ghana Mobile Money charges.
 */

const PAYSTACK_BASE = 'https://api.paystack.co'

function getSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not set')
  return key
}

function headers() {
  return {
    Authorization: `Bearer ${getSecretKey()}`,
    'Content-Type': 'application/json',
  }
}

export type MoMoProvider = 'mtn' | 'vod' | 'atl'

export interface InitiateChargeResult {
  reference: string
  status: string          // 'send_otp' | 'pay_offline' | 'success' | 'failed'
  displayText: string
  paystackReference: string
}

/**
 * Initiate a Ghana Mobile Money charge via Paystack.
 * Sends a prompt to the customer's phone.
 */
export async function initiateMoMoCharge(params: {
  email: string
  amountPesewas: number   // pesewas (GHS × 100)
  phone: string           // e.g. "0244000000"
  provider: MoMoProvider
  reference: string       // our internal booking_payment ID or unique ref
  metadata?: Record<string, unknown>
}): Promise<InitiateChargeResult> {
  const body = {
    email:    params.email,
    amount:   params.amountPesewas,           // Paystack uses pesewas for GHS
    currency: 'GHS',
    mobile_money: {
      phone:    params.phone,
      provider: params.provider,
    },
    reference: params.reference,
    metadata:  params.metadata ?? {},
  }

  const res = await fetch(`${PAYSTACK_BASE}/charge`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })

  const json = await res.json()

  if (!res.ok || !json.status) {
    throw new Error(json.message ?? 'Paystack charge initiation failed')
  }

  return {
    reference:        params.reference,
    status:           json.data.status,
    displayText:      json.data.display_text ?? 'Check your phone to approve the payment.',
    paystackReference: json.data.reference,
  }
}

/**
 * Submit OTP to complete a charge that returned status: 'send_otp'.
 */
export async function submitOtp(reference: string, otp: string) {
  const res = await fetch(`${PAYSTACK_BASE}/charge/submit_otp`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ reference, otp }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.message ?? 'OTP submission failed')
  return json.data as { status: string; display_text?: string }
}

/**
 * Check the status of a pending charge.
 */
export async function verifyCharge(reference: string) {
  const res = await fetch(`${PAYSTACK_BASE}/charge/${reference}`, {
    headers: headers(),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.message ?? 'Charge verification failed')
  return json.data as { status: string; amount: number; currency: string }
}

/**
 * Verify a webhook event signature.
 * Paystack sends X-Paystack-Signature header.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const crypto = require('crypto') // eslint-disable-line @typescript-eslint/no-var-requires
  const hash = crypto
    .createHmac('sha512', getSecretKey())
    .update(rawBody)
    .digest('hex')
  return hash === signature
}
