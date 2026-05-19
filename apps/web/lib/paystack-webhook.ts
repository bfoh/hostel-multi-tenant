/**
 * Paystack webhook signature verification.
 *
 * Kept separate from `lib/paystack.ts` because it imports `node:crypto`,
 * which is unavailable in the Edge runtime. The rest of the Paystack
 * helpers (charges, transactions, subaccounts) can run in either runtime;
 * only this verifier is Node-only.
 *
 * Paystack sends an X-Paystack-Signature header containing the HMAC-SHA512
 * of the raw request body, keyed by PAYSTACK_SECRET_KEY.
 */
import { createHmac } from 'node:crypto'

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) return false
  const hash = createHmac('sha512', key).update(rawBody).digest('hex')
  return hash === signature
}
