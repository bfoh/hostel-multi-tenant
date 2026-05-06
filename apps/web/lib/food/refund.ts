/**
 * Paystack refund wrapper for food orders.
 * Reuses PAYSTACK_SECRET_KEY env. No-op when not configured.
 */
export async function refundFoodOrder(paystackReference: string, amountPesewas: number) {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) return { ok: false as const, reason: 'Paystack not configured' }

  const res = await fetch('https://api.paystack.co/refund', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      transaction: paystackReference,
      amount:      amountPesewas,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { ok: false as const, reason: text.slice(0, 280) }
  }
  return { ok: true as const }
}
